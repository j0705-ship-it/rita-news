import { NextRequest, NextResponse } from 'next/server';
import { getArticles, saveArticles } from '@/lib/kv-store';
import { fetchGoogleNewsRSS } from '@/lib/rss';
import { filterArticles, generateArticleId, dedupeArticles, clusterSimilarArticles, dedupeByTitle } from '@/lib/article-normalizer';
import { evaluateArticles } from '@/lib/news-evaluator';
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

    let allArticles: ArticleWithSummary[] = [];

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

        // 評価・要約生成
        if (articles.length > 0) {
          let evaluatedArticles: ArticleWithSummary[];
          
          try {
            console.log(`[FEED] 評価・要約生成開始: ${keyword} - ${articles.length}件`);
            evaluatedArticles = await evaluateArticles(articles, keyword);
            
            // keep=trueの記事だけ残す
            const keptArticles = evaluatedArticles.filter(article => article.keep === true);
            console.log(`[FEED] 評価完了: ${keyword} - 全体 ${evaluatedArticles.length}件、保持 ${keptArticles.length}件`);
            
            // importanceScore + relevanceScore の降順で並べ替え
            keptArticles.sort((a, b) => {
              const scoreA = (a.importanceScore || 0) + (a.relevanceScore || 0);
              const scoreB = (b.importanceScore || 0) + (b.relevanceScore || 0);
              return scoreB - scoreA;
            });
            
            // タイトル完全一致による重複除去（最初の1件を保持）
            const beforeTitleDedupeCount = keptArticles.length;
            const titleDeduplicatedArticles = dedupeByTitle(keptArticles);
            const afterTitleDedupeCount = titleDeduplicatedArticles.length;
            if (isDev && beforeTitleDedupeCount > afterTitleDedupeCount) {
              console.log(`[FEED] ${keyword}: タイトル重複除去 ${beforeTitleDedupeCount}件 → ${afterTitleDedupeCount}件 (${beforeTitleDedupeCount - afterTitleDedupeCount}件除去)`);
            }
            
            // URL重複除去（keywordセクションごと）
            const beforeUrlDedupeCount = titleDeduplicatedArticles.length;
            const urlDeduplicatedArticles = dedupeArticles(titleDeduplicatedArticles);
            const afterUrlDedupeCount = urlDeduplicatedArticles.length;
            if (isDev && beforeUrlDedupeCount > afterUrlDedupeCount) {
              console.log(`[FEED] ${keyword}: URL重複除去 ${beforeUrlDedupeCount}件 → ${afterUrlDedupeCount}件 (${beforeUrlDedupeCount - afterUrlDedupeCount}件除去)`);
            }
            
            // タイトル類似度によるトピック重複除去（同じ出来事を1件にまとめる）
            const beforeClusterCount = urlDeduplicatedArticles.length;
            const clusteredArticles = clusterSimilarArticles(urlDeduplicatedArticles, 0.75, isDev);
            const afterClusterCount = clusteredArticles.length;
            if (isDev && beforeClusterCount > afterClusterCount) {
              console.log(`[FEED] ${keyword}: トピック重複除去 ${beforeClusterCount}件 → ${afterClusterCount}件 (${beforeClusterCount - afterClusterCount}件除去)`);
            } else if (isDev) {
              console.log(`[FEED] ${keyword}: トピック重複除去 ${beforeClusterCount}件 → ${afterClusterCount}件 (重複なし)`);
            }
            
            allArticles.push(...clusteredArticles.map(article => ({
              ...article,
              category: keyword
            })));
            
            console.log(`[FEED] キーワード処理完了: ${keyword} - ${clusteredArticles.length}件`);
          } catch (evalError) {
            console.error(`[FEED] 評価エラー: ${keyword}`, evalError);
            if (evalError instanceof Error && evalError.stack) {
              console.error(`[FEED] スタック:`, evalError.stack);
            }
            // 評価エラー時は空配列（記事を表示しない）
            console.log(`[FEED] 評価エラーのため記事を除外: ${keyword}`);
          }
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

    // 全体でタイトル完全一致による重複除去
    const beforeTitleDedupeCount = allArticles.length;
    allArticles = dedupeByTitle(allArticles);
    const afterTitleDedupeCount = allArticles.length;
    
    if (isDev && beforeTitleDedupeCount > afterTitleDedupeCount) {
      console.log(`[FEED] 全体タイトル重複除去: ${beforeTitleDedupeCount}件 → ${afterTitleDedupeCount}件 (${beforeTitleDedupeCount - afterTitleDedupeCount}件除去)`);
    }
    
    // 全体でURL重複除去（複数keywordで同じ記事が含まれる可能性があるため）
    const beforeUrlDedupeCount = allArticles.length;
    allArticles = dedupeArticles(allArticles);
    const afterUrlDedupeCount = allArticles.length;
    
    if (isDev && beforeUrlDedupeCount > afterUrlDedupeCount) {
      console.log(`[FEED] 全体URL重複除去: ${beforeUrlDedupeCount}件 → ${afterUrlDedupeCount}件 (${beforeUrlDedupeCount - afterUrlDedupeCount}件除去)`);
    }
    
    // 全体でトピック重複除去（同じトピックの記事を1件にまとめる）
    const beforeClusterCount = allArticles.length;
    allArticles = clusterSimilarArticles(allArticles, 0.75, isDev);
    const afterClusterCount = allArticles.length;
    
    if (isDev && beforeClusterCount > afterClusterCount) {
      console.log(`[FEED] 全体トピック重複除去: ${beforeClusterCount}件 → ${afterClusterCount}件 (${beforeClusterCount - afterClusterCount}件除去)`);
    }

    // importanceScore + relevanceScore の降順で並べ替え（既にソート済みだが、全体で再ソート）
    allArticles.sort((a, b) => {
      const scoreA = (a.importanceScore || 0) + (a.relevanceScore || 0);
      const scoreB = (b.importanceScore || 0) + (b.relevanceScore || 0);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      // スコアが同じ場合は日付でソート
      try {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      } catch {
        return 0;
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[FEED] 処理完了: 合計 ${allArticles.length}件、所要時間 ${duration}ms`);

    // 記事が0件の場合のメッセージ（ダミー記事は返さない）
    if (allArticles.length === 0 && keywords.length > 0) {
      console.log(`[FEED] 記事が0件: 広告・求人・ブログ等を除外したため記事がありません`);
    }

    const response: FeedResponse = {
      articles: allArticles.slice(0, limit * keywords.length),
      updatedAt: new Date().toISOString()
    };

    if (allArticles.length === 0) {
      response.message = '広告・求人・ブログ等を除外したため記事がありません';
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


