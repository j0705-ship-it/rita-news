import { kv } from '@vercel/kv';
import { Article } from '../types/article';
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

const TTL = 86400; // 24 hours in seconds

export function getDateKey(date: Date = new Date()): string {
  const jstDate = utcToZonedTime(date, 'Asia/Tokyo');
  return format(jstDate, 'yyyy-MM-dd');
}

export function getKVKey(keyword: string, date?: string): string {
  const dateStr = date || getDateKey();
  const normalizedKeyword = keyword.trim().toLowerCase();
  return `news:${normalizedKeyword}:${dateStr}`;
}

export async function saveArticles(
  keyword: string,
  articles: Article[]
): Promise<void> {
  try {
    const key = getKVKey(keyword);
    await kv.setex(key, TTL, JSON.stringify(articles));
    console.log(`Saved ${articles.length} articles for ${keyword} with key ${key}`);
  } catch (error) {
    console.error('Failed to save articles to KV:', error);
    throw error;
  }
}

export async function getArticles(keyword: string): Promise<Article[] | null> {
  try {
    const key = getKVKey(keyword);
    const data = await kv.get<string>(key);
    
    if (!data) {
      return null;
    }

    const articles = JSON.parse(data) as Article[];
    return articles;
  } catch (error) {
    console.error('Failed to get articles from KV:', error);
    return null;
  }
}

export async function getArticlesForDate(
  keyword: string,
  date: string
): Promise<Article[] | null> {
  try {
    const key = getKVKey(keyword, date);
    const data = await kv.get<string>(key);
    
    if (!data) {
      return null;
    }

    const articles = JSON.parse(data) as Article[];
    return articles;
  } catch (error) {
    console.error('Failed to get articles from KV for date:', error);
    return null;
  }
}

export async function clearOldArticles(): Promise<void> {
  try {
    const today = getDateKey();
    const yesterday = getDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    
    const keys = await kv.keys('news:*');
    
    for (const key of keys) {
      const keyStr = key as string;
      if (!keyStr.includes(today) && !keyStr.includes(yesterday)) {
        await kv.del(keyStr);
        console.log(`Deleted old article key: ${keyStr}`);
      }
    }
  } catch (error) {
    console.error('Failed to clear old articles:', error);
  }
}

