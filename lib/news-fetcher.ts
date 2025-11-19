import { Article } from '../types/article';
import { normalizeArticle, deduplicateArticles, sortArticlesByDate, RSSItem } from './article-normalizer';
import { XMLParser } from 'fast-xml-parser';

const PROXY_URLS = [
  'https://api.allorigins.win/raw?url=',
  'https://api.rss2json.com/v1/api.json?rss_url='
];

interface RSS2JSONResponse {
  items?: Array<{
    title?: string;
    link?: string;
    description?: string;
    content?: string;
    pubDate?: string;
    pubDate_iso?: string;
    pubDate_tz?: string;
    source?: string;
    guid?: string;
  }>;
  feed?: {
    title?: string;
  };
}

export async function fetchGoogleNews(
  keywords: string[],
  category: string,
  scope: 'jp' | 'global' = 'jp'
): Promise<Article[]> {
  const negative = [
    '-採用', '-求人', '-募集', '-アルバイト', '-パート', '-年収', '-給与',
    '-新卒', '-中途', '-転職', '-リクルート', '-Indeed'
  ];
  
  const query = keywords.join(' OR ') + ' ' + negative.join(' ');
  const q = encodeURIComponent(query);
  const hl = 'ja';
  const gl = scope === 'jp' ? 'JP' : 'US';
  const ceid = scope === 'jp' ? 'JP:ja' : 'US:en';
  
  const baseUrl = `https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  
  let lastError: Error | null = null;
  
  for (const proxyUrl of PROXY_URLS) {
    try {
      const url = proxyUrl + encodeURIComponent(baseUrl);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (url.includes('rss2json')) {
        const data: RSS2JSONResponse = await response.json();
        
        if (!data.items || data.items.length === 0) {
          throw new Error('No items in RSS2JSON response');
        }

        const articles: Article[] = [];
        const sourceName = data.feed?.title || 'Google News';

        for (const item of data.items) {
          const rssItem: RSSItem = {
            title: item.title,
            link: item.link,
            description: item.description || item.content,
            pubDate: item.pubDate || item.pubDate_iso || item.pubDate_tz,
            source: sourceName,
            guid: item.guid
          };

          const article = normalizeArticle(rssItem, category, sourceName);
          if (article) {
            articles.push(article);
          }
        }

        const deduped = deduplicateArticles(articles);
        return sortArticlesByDate(deduped);
      } else {
        const xmlText = await response.text();
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
          textNodeName: '#text'
        });
        
        const parsed = parser.parse(xmlText);
        const channel = parsed.rss?.channel || parsed.feed;
        
        if (!channel) {
          throw new Error('Invalid RSS format');
        }

        const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
        const sourceName = channel.title || channel['#text'] || 'Google News';

        const articles: Article[] = [];

        for (const item of items) {
          const rssItem: RSSItem = {
            title: item.title?.['#text'] || item.title,
            link: item.link?.['#text'] || item.link || item.guid?.['#text'] || item.guid,
            description: item.description?.['#text'] || item.description || item.content?.['#text'] || item.content,
            pubDate: item.pubDate?.['#text'] || item.pubDate || item['pubDate:iso'] || item['pubDate:tz'],
            source: item.source?.['#text'] || item.source || sourceName,
            guid: item.guid?.['#text'] || item.guid
          };

          const article = normalizeArticle(rssItem, category, sourceName);
          if (article) {
            articles.push(article);
          }
        }

        const deduped = deduplicateArticles(articles);
        return sortArticlesByDate(deduped);
      }
    } catch (error) {
      lastError = error as Error;
      console.error(`Failed to fetch from ${proxyUrl}:`, error);
      continue;
    }
  }

  throw new Error(`All proxy attempts failed. Last error: ${lastError?.message}`);
}

export async function fetchYahooNews(
  keywords: string[],
  category: string
): Promise<Article[]> {
  const query = keywords.join(' OR ');
  const q = encodeURIComponent(query);
  
  const baseUrl = `https://news.yahoo.co.jp/rss/search?p=${q}`;
  
  try {
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    });
    
    const parsed = parser.parse(xmlText);
    const channel = parsed.rss?.channel || parsed.feed;
    
    if (!channel) {
      throw new Error('Invalid RSS format');
    }

    const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
    const sourceName = channel.title || 'Yahoo News';

    const articles: Article[] = [];

    for (const item of items) {
      const rssItem: RSSItem = {
        title: item.title?.['#text'] || item.title,
        link: item.link?.['#text'] || item.link || item.guid?.['#text'] || item.guid,
        description: item.description?.['#text'] || item.description || item.content?.['#text'] || item.content,
        pubDate: item.pubDate?.['#text'] || item.pubDate || item['pubDate:iso'] || item['pubDate:tz'],
        source: item.source?.['#text'] || item.source || sourceName,
        guid: item.guid?.['#text'] || item.guid
      };

      const article = normalizeArticle(rssItem, category, sourceName);
      if (article) {
        articles.push(article);
      }
    }

    const deduped = deduplicateArticles(articles);
    return sortArticlesByDate(deduped);
  } catch (error) {
    throw new Error(`Failed to fetch Yahoo News: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function fetchNews(
  keywords: string[],
  category: string,
  scope: 'jp' | 'global' = 'jp'
): Promise<Article[]> {
  let articles: Article[] = [];
  let lastError: Error | null = null;

  try {
    articles = await fetchGoogleNews(keywords, category, scope);
    if (articles.length > 0) {
      return articles;
    }
  } catch (error) {
    lastError = error as Error;
    console.error('Google News fetch failed:', error);
  }

  try {
    const yahooArticles = await fetchYahooNews(keywords, category);
    if (yahooArticles.length > 0) {
      return yahooArticles;
    }
  } catch (error) {
    console.error('Yahoo News fetch failed:', error);
  }

  if (articles.length > 0) {
    return articles;
  }

  throw new Error(`Failed to fetch news from all sources. Last error: ${lastError?.message}`);
}

