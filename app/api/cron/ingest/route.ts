import { NextRequest, NextResponse } from 'next/server';
import { fetchNews } from '@/lib/news-fetcher';
import { filterArticles } from '@/lib/article-normalizer';
import { saveArticles } from '@/lib/kv-store';
import { generateSummaries } from '@/lib/openai-client';

const DEFAULT_KEYWORDS = ['カフェ', '美容室', 'ネイルサロン', 'まつげサロン', '居酒屋', 'バー', 'パン屋', '英会話スクール', 'ヨガスタジオ'];

const getInitialKeywords = (): string[] => {
  const preset = process.env.PRESET_KEYWORDS;
  if (preset) {
    return preset.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }
  return DEFAULT_KEYWORDS;
};

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[INGEST] 開始: ${new Date().toISOString()}`);
  
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[INGEST] 認証失敗: 不正な認証トークン');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const results: Array<{ keyword: string; success: boolean; count: number; error?: string }> = [];
    const scope = 'jp';
    const keywords = getInitialKeywords();
    
    console.log(`[INGEST] キーワード数: ${keywords.length}`);
    console.log(`[INGEST] キーワード: ${keywords.join(', ')}`);

    for (const keyword of keywords) {
      const keywordStartTime = Date.now();
      console.log(`[INGEST] 処理開始: ${keyword}`);
      
      try {
        const fetchedArticles = await fetchNews([keyword], keyword, scope);
        console.log(`[INGEST] ${keyword}: 取得件数 ${fetchedArticles.length}件`);
        
        const filtered = filterArticles(fetchedArticles, keyword);
        console.log(`[INGEST] ${keyword}: フィルタ後 ${filtered.length}件`);
        
        const articles = filtered.slice(0, 20);

        if (articles.length > 0) {
          let articlesWithSummary;
          
          if (process.env.OPENAI_API_KEY) {
            try {
              console.log(`[INGEST] ${keyword}: 要約生成開始 (${articles.length}件)`);
              articlesWithSummary = await generateSummaries(articles);
              console.log(`[INGEST] ${keyword}: 要約生成完了 (${articlesWithSummary.length}件)`);
            } catch (error) {
              console.error(`[INGEST] ${keyword}: 要約生成失敗:`, error);
              articlesWithSummary = articles.map(article => {
                const fallbackSummary = article.description.split(/[。\.]/)[0] || article.description.slice(0, 60);
                return {
                  ...article,
                  summary: fallbackSummary.length > 60 ? fallbackSummary.slice(0, 57) + '...' : fallbackSummary
                };
              });
            }
          } else {
            console.log(`[INGEST] ${keyword}: OpenAI API Key未設定、フォールバック要約を使用`);
            articlesWithSummary = articles.map(article => {
              const fallbackSummary = article.description.split(/[。\.]/)[0] || article.description.slice(0, 60);
              return {
                ...article,
                summary: fallbackSummary.length > 60 ? fallbackSummary.slice(0, 57) + '...' : fallbackSummary
              };
            });
          }

          const articlesToSave = articlesWithSummary.map(article => ({
            ...article,
            category: keyword
          }));
          
          console.log(`[INGEST] ${keyword}: KV保存開始 (${articlesToSave.length}件)`);
          await saveArticles(keyword, articlesToSave);
          console.log(`[INGEST] ${keyword}: KV保存完了`);
          
          const keywordDuration = Date.now() - keywordStartTime;
          console.log(`[INGEST] ${keyword}: 処理完了 (${keywordDuration}ms)`);
          
          results.push({
            keyword,
            success: true,
            count: articlesWithSummary.length
          });
        } else {
          console.warn(`[INGEST] ${keyword}: 記事が見つかりませんでした`);
          results.push({
            keyword,
            success: false,
            count: 0,
            error: 'No articles found'
          });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        const keywordDuration = Date.now() - keywordStartTime;
        console.error(`[INGEST] ${keyword}: エラー (${keywordDuration}ms):`, error);
        results.push({
          keyword,
          success: false,
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.reduce((sum, r) => sum + r.count, 0);
    const duration = Date.now() - startTime;

    console.log(`[INGEST] 完了: 成功 ${successCount}/${keywords.length}、合計 ${totalCount}件、所要時間 ${duration}ms`);
    
    if (successCount < keywords.length) {
      const failedKeywords = results.filter(r => !r.success).map(r => r.keyword);
      console.warn(`[INGEST] 失敗したキーワード: ${failedKeywords.join(', ')}`);
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalKeywords: keywords.length,
        successCount,
        totalArticles: totalCount,
        duration: `${duration}ms`
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[INGEST] エラー (${duration}ms):`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}
