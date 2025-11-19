import { Article } from '../types/article';
import { getKeywords } from './category-keywords';

export interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  'pubDate:iso'?: string;
  'pubDate:tz'?: string;
  source?: string;
  guid?: string;
}

export function normalizeArticle(
  item: RSSItem,
  category: string,
  sourceName: string = ''
): Article | null {
  const title = (item.title || '').trim();
  const link = (item.link || item.guid || '').trim();
  const description = (item.description || item.content || '').trim();
  const pubDate = item.pubDate || item['pubDate:iso'] || item['pubDate:tz'] || '';
  const source = (item.source || sourceName || '').trim();

  if (!title || !link) {
    return null;
  }

  const id = generateArticleId(link);
  const fetchedAt = new Date().toISOString();

  return {
    id,
    title,
    link,
    description,
    pubDate: pubDate || fetchedAt,
    source,
    category,
    fetchedAt
  };
}

export function deduplicateArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const result: Article[] = [];

  for (const article of articles) {
    if (!article.id || seen.has(article.id)) {
      continue;
    }
    seen.add(article.id);
    result.push(article);
  }

  return result;
}

export function filterArticles(articles: Article[], keyword: string): Article[] {
  let keywords: string[];
  try {
    keywords = getKeywords(keyword);
  } catch {
    keywords = [keyword];
  }
  const keywordSet = new Set(keywords.map(k => k.toLowerCase()));
  
  const blocks = [
    '採用', '求人', '募集', 'アルバイト', 'パート', '年収', '給与',
    '新卒', '中途', '転職', 'リクルート', 'indeed', 'wantedly'
  ];

  const beautyIncludes = [
    '来店', '顧客', '予約', '口コミ', '施術', 'カット', 'カラー', 'パーマ',
    'トリートメント', 'ヘア', 'スタイル', '再来', '指名', '単価', '値上げ'
  ];

  const beautyCategories = [
    '美容室', 'ネイルサロン', 'まつげサロン', 'エステサロン',
    '脱毛サロン', 'メンズサロン', 'ブライダルサロン', '整体院',
    'リラクゼーションサロン'
  ];

  return articles.filter(article => {
    const text = `${article.title} ${article.description}`.toLowerCase();
    
    if (blocks.some(block => text.includes(block))) {
      return false;
    }

    if (beautyCategories.includes(keyword)) {
      return beautyIncludes.some(k => text.includes(k));
    }

    const hasKeyword = keywords.some(k => 
      text.includes(k.toLowerCase())
    );
    
    return hasKeyword || text.includes(keyword.toLowerCase());
  });
}

export function generateArticleId(link: string): string {
  try {
    const url = new URL(link);
    const hash = url.pathname + url.search;
    return hash.slice(0, 100);
  } catch {
    return link.slice(0, 100);
  }
}

export function sortArticlesByDate(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => {
    const dateA = new Date(a.pubDate).getTime();
    const dateB = new Date(b.pubDate).getTime();
    return dateB - dateA;
  });
}

