/**
 * Google News RSS取得モジュール
 * - タイムアウト: 8秒
 * - 失敗時: 空配列を返す（エラーを投げない）
 */

export interface RSSArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description: string;
}

/**
 * Google News RSSから記事を取得
 * @param keyword 検索キーワード
 * @returns 正規化された記事配列（失敗時は空配列）
 */
export async function fetchGoogleNewsRSS(keyword: string): Promise<RSSArticle[]> {
  const timeout = 8000; // 8秒
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=JP&ceid=JP:ja`;
    
    console.log(`[RSS] 取得開始: ${keyword}`);
    console.log(`[RSS] URL: ${url}`);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[RSS] HTTPエラー: ${response.status} ${response.statusText}`);
      return [];
    }

    const xmlText = await response.text();
    
    if (!xmlText || xmlText.trim().length === 0) {
      console.error(`[RSS] 空のレスポンス`);
      return [];
    }

    // XMLパース（簡易版）
    const articles = parseRSSXML(xmlText, keyword);
    
    console.log(`[RSS] 取得完了: ${keyword} - ${articles.length}件`);
    return articles;

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`[RSS] タイムアウト: ${keyword} (8秒)`);
      } else {
        console.error(`[RSS] エラー: ${keyword} - ${error.message}`);
        if (error.stack) {
          console.error(`[RSS] スタック: ${error.stack}`);
        }
      }
    } else {
      console.error(`[RSS] 不明なエラー: ${keyword}`, error);
    }
    
    return [];
  }
}

/**
 * RSS XMLをパースして記事配列に変換
 */
function parseRSSXML(xmlText: string, keyword: string): RSSArticle[] {
  const articles: RSSArticle[] = [];
  
  try {
    // <item>タグを抽出
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = xmlText.match(itemRegex);
    
    if (!items || items.length === 0) {
      console.warn(`[RSS] 記事が見つかりません: ${keyword}`);
      return [];
    }

    for (const item of items) {
      try {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const descriptionMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/) || item.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/);

        const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
        const link = (linkMatch?.[1] || '').trim();
        const description = (descriptionMatch?.[1] || descriptionMatch?.[2] || '').trim();
        const pubDate = (pubDateMatch?.[1] || '').trim();
        const source = (sourceMatch?.[1] || 'Google News').trim();

        // タイトルとリンクがない場合はスキップ
        if (!title || !link) {
          continue;
        }

        // HTMLタグを除去
        const cleanTitle = title.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        const cleanDescription = description.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

        articles.push({
          title: cleanTitle,
          url: link,
          source: source || 'Google News',
          publishedAt: pubDate || new Date().toISOString(),
          description: cleanDescription || cleanTitle
        });
      } catch (itemError) {
        console.warn(`[RSS] 記事のパースに失敗:`, itemError);
        continue;
      }
    }

    return articles;
  } catch (error) {
    console.error(`[RSS] XMLパースエラー: ${keyword}`, error);
    return [];
  }
}



