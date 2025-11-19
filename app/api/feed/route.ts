import { NextRequest, NextResponse } from 'next/server';
import { getArticles, saveArticles } from '@/lib/kv-store';
import { fetchGoogleNewsRSS } from '@/lib/rss';
import { filterArticles, generateArticleId } from '@/lib/article-normalizer';
import { generateSummaries } from '@/lib/openai-client';
import { FeedResponse, ArticleWithSummary, Article } from '@/types/article';

export const runtime = 'nodejs';

// 同義語マップ
const SYNONYM_MAP: Record<string, string[]> = {
  '美容室': ['美容院', 'ヘアサロン'],
  'カフェ': ['喫茶店', 'コーヒーショップ'],
  '居酒屋': ['飲み屋', '居酒屋チェーン'],
  'ネイルサロン': ['ネイル', 'ジェルネイル'],
  'まつげサロン': ['まつげエクステ', 'アイラッシュ'],
  'バー': ['バー', 'パブ'],
  'パン屋': ['ベーカリー', 'パンショップ'],
  '英会話スクール': ['英会話', '英語教室'],
  'ヨガスタジオ': ['ヨガ', 'ヨガ教室']
};

/**
 * キーワードの同義語を取得
 */
function getSynonyms(keyword: string): string[] {
  return SYNONYM_MAP[keyword] || [];
}

/**
 * RSSArticleをArticleに変換
 */
function convertRSSArticleToArticle(rssArticle: { title: string; url: string; source: string; publishedAt: string; description: string }, keyword: string): Article {
  return {
    id: generateArticleId(rssArticle.url),
    title: rssArticle.title,
    link: rssArticle.url,
    description: rssArticle.description || rssArticle.title,
    pubDate: rssArticle.publishedAt,
    source: rssArticle.source,
    category: keyword,
    fetchedAt: new Date().toISOString()
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    console.log(`[FEED] リクエスト開始: ${new Date().toISOString()}`);
    
    const searchParams = request.nextUrl.searchParams;
    const keywordsParam = searchParams.get('keywords') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    console.log(`[FEED] パラメータ: keywords=${keywordsParam}, limit=${limit}`);

    if (!keywordsParam) {
      console.warn(`[FEED] キーワードが指定されていません`);
      return NextResponse.json(
        {
          articles: [],
          updatedAt: new Date().toISOString(),
          message: 'keywords parameter is required'
        } as FeedResponse,
        { status: 200 }
      );
    }

    const keywords = keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keywords.length === 0) {
      console.warn(`[FEED] 有効なキーワードがありません`);
      return NextResponse.json(
        {
          articles: [],
          updatedAt: new Date().toISOString(),
          message: 'No valid keywords provided'
        } as FeedResponse,
        { status: 200 }
      );
    }

    console.log(`[FEED] 処理キーワード: ${keywords.join(', ')}`);

    const allArticles: ArticleWithSummary[] = [];

    for (const keyword of keywords) {
      try {
        console.log(`[FEED] キーワード処理開始: ${keyword}`);
        
        // キャッシュから取得を試みる
        let articles: Article[] = [];
        try {
          const cachedArticles = await getArticles(keyword);
          if (cachedArticles && cachedArticles.length > 0) {
            console.log(`[FEED] キャッシュから取得: ${keyword} - ${cachedArticles.length}件`);
            articles = cachedArticles.slice(0, limit);
          }
        } catch (cacheError) {
          console.error(`[FEED] キャッシュ取得エラー: ${keyword}`, cacheError);
          if (cacheError instanceof Error && cacheError.stack) {
            console.error(`[FEED] スタック:`, cacheError.stack);
          }
        }

        // キャッシュにない場合はRSSから取得
        if (articles.length === 0) {
          try {
            console.log(`[FEED] RSS取得開始: ${keyword}`);
            console.log(`[FEED] RSS URL: https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=JP&ceid=JP:ja`);
            const rssArticles = await fetchGoogleNewsRSS(keyword);
            console.log(`[FEED] RSS取得結果: ${keyword} - ${rssArticles.length}件`);
            
            if (rssArticles.length === 0) {
              console.warn(`[FEED] RSSから記事が取得できませんでした: ${keyword}`);
              // 同義語で再試行
              const synonyms = getSynonyms(keyword);
              console.log(`[FEED] 0件のため同義語で再試行: ${keyword} -> ${synonyms.join(', ')}`);
              
              for (const synonym of synonyms.slice(0, 1)) { // 1回だけ再試行
                try {
                  const synonymArticles = await fetchGoogleNewsRSS(synonym);
                  if (synonymArticles.length > 0) {
                    console.log(`[FEED] 同義語で取得成功: ${synonym} - ${synonymArticles.length}件`);
                    articles = synonymArticles.map(item => convertRSSArticleToArticle(item, keyword));
                    break;
                  }
                } catch (synonymError) {
                  console.error(`[FEED] 同義語取得エラー: ${synonym}`, synonymError);
                }
              }
            } else {
              articles = rssArticles.map(item => convertRSSArticleToArticle(item, keyword));
            }

            // フィルタリング
            if (articles.length > 0) {
              try {
                const filtered = filterArticles(articles, keyword);
                console.log(`[FEED] フィルタ後: ${keyword} - ${filtered.length}件`);
                articles = filtered.slice(0, limit);
              } catch (filterError) {
                console.error(`[FEED] フィルタエラー: ${keyword}`, filterError);
                if (filterError instanceof Error && filterError.stack) {
                  console.error(`[FEED] スタック:`, filterError.stack);
                }
                articles = articles.slice(0, limit); // フィルタ失敗時はそのまま使用
              }
            }

            // キャッシュに保存
            if (articles.length > 0) {
              try {
                await saveArticles(keyword, articles);
                console.log(`[FEED] キャッシュ保存: ${keyword} - ${articles.length}件`);
              } catch (saveError) {
                console.error(`[FEED] キャッシュ保存エラー: ${keyword}`, saveError);
                // 保存エラーは無視（続行）
              }
            }
          } catch (rssError) {
            console.error(`[FEED] RSS取得エラー: ${keyword}`, rssError);
            if (rssError instanceof Error && rssError.stack) {
              console.error(`[FEED] スタック:`, rssError.stack);
            }
            // RSS取得エラーは続行（空配列のまま）
          }
        }

        // 要約生成
        if (articles.length > 0) {
          let articlesWithSummary: ArticleWithSummary[];
          
          if (process.env.OPENAI_API_KEY) {
            try {
              console.log(`[FEED] 要約生成開始: ${keyword} - ${articles.length}件`);
              articlesWithSummary = await generateSummaries(articles);
              console.log(`[FEED] 要約生成完了: ${keyword} - ${articlesWithSummary.length}件`);
            } catch (summaryError) {
              console.error(`[FEED] 要約生成エラー: ${keyword}`, summaryError);
              if (summaryError instanceof Error && summaryError.stack) {
                console.error(`[FEED] スタック:`, summaryError.stack);
              }
              // 要約エラー時は要約なしで返す
              articlesWithSummary = articles.map(article => ({
                ...article,
                summary: ''
              }));
            }
          } else {
            console.log(`[FEED] OpenAI API Key未設定、要約をスキップ: ${keyword}`);
            articlesWithSummary = articles.map(article => ({
              ...article,
              summary: ''
            }));
          }

          allArticles.push(...articlesWithSummary.map(article => ({
            ...article,
            category: keyword
          })));
          
          console.log(`[FEED] キーワード処理完了: ${keyword} - ${articlesWithSummary.length}件`);
        } else {
          console.log(`[FEED] 記事なし: ${keyword}`);
        }
      } catch (keywordError) {
        console.error(`[FEED] キーワード処理エラー: ${keyword}`, keywordError);
        if (keywordError instanceof Error && keywordError.stack) {
          console.error(`[FEED] スタック:`, keywordError.stack);
        }
        // キーワードエラーは続行（次のキーワードへ）
      }
    }

    // 日付でソート
    allArticles.sort((a, b) => {
      try {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      } catch {
        return 0;
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[FEED] 処理完了: 合計 ${allArticles.length}件、所要時間 ${duration}ms`);

    // 記事が0件の場合はダミー記事を1件返す（フォールバック）
    if (allArticles.length === 0 && keywords.length > 0) {
      const firstKeyword = keywords[0];
      console.warn(`[FEED] 記事が0件のため、ダミー記事を返します: ${firstKeyword}`);
      
      const dummyArticle: ArticleWithSummary = {
        id: 'dummy-article-fallback',
        title: 'テスト記事',
        link: 'https://example.com',
        description: 'これはテスト用のダミー記事です。実際の記事取得に失敗した場合に表示されます。',
        pubDate: new Date().toISOString(),
        source: 'テスト',
        category: firstKeyword,
        fetchedAt: new Date().toISOString(),
        summary: 'RSS取得に失敗したため、テスト用記事を表示しています。'
      };
      
      allArticles.push(dummyArticle);
    }

    const response: FeedResponse = {
      articles: allArticles.slice(0, limit * keywords.length),
      updatedAt: new Date().toISOString()
    };

    if (allArticles.length === 0) {
      response.message = 'no articles';
      if (isDev) {
        response.debug = '記事が見つかりませんでした。ログを確認してください。';
      }
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[FEED] 致命的エラー (${duration}ms):`, error);
    if (error instanceof Error && error.stack) {
      console.error(`[FEED] スタック:`, error.stack);
    }

    const response: FeedResponse = {
      articles: [],
      updatedAt: new Date().toISOString(),
      message: 'エラーが発生しました'
    };

    if (process.env.NODE_ENV === 'development') {
      response.debug = error instanceof Error ? error.message : 'Unknown error';
    }

    return NextResponse.json(response, { status: 200 });
  }
}
