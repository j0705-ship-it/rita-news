import { NextRequest, NextResponse } from 'next/server';
import { getArticles, saveArticles } from '../../lib/kv-store';
import { fetchNews } from '../../lib/news-fetcher';
import { filterArticles } from '../../lib/article-normalizer';
import { getKeywords } from '../../lib/category-keywords';
import { generateSummaries } from '../../lib/openai-client';
import { FeedResponse, ArticleWithSummary } from '../../types/article';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || 'カフェ';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const scope = (searchParams.get('scope') || 'jp') as 'jp' | 'global';

    let articles = await getArticles(category);

    if (!articles || articles.length === 0) {
      const keywords = getKeywords(category);
      
      try {
        const fetchedArticles = await fetchNews(keywords, category, scope);
        const filtered = filterArticles(fetchedArticles, category);
        articles = filtered.slice(0, limit);

        if (articles.length > 0) {
          await saveArticles(category, articles);
        }
      } catch (error) {
        console.error(`Failed to fetch news for ${category}:`, error);
        return NextResponse.json(
          {
            articles: [],
            updatedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Failed to fetch news'
          } as FeedResponse,
          { status: 500 }
        );
      }
    } else {
      articles = articles.slice(0, limit);
    }

    let articlesWithSummary: ArticleWithSummary[];
    
    if (process.env.OPENAI_API_KEY) {
      try {
        articlesWithSummary = await generateSummaries(articles);
      } catch (error) {
        console.error('Failed to generate summaries:', error);
        articlesWithSummary = articles.map(article => ({
          ...article,
          summary: article.description.split(/[。\.]/)[0] || article.description.slice(0, 120)
        }));
      }
    } else {
      articlesWithSummary = articles.map(article => ({
        ...article,
        summary: article.description.split(/[。\.]/)[0] || article.description.slice(0, 120)
      }));
    }

    return NextResponse.json({
      articles: articlesWithSummary,
      updatedAt: new Date().toISOString()
    } as FeedResponse);
  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json(
      {
        articles: [],
        updatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      } as FeedResponse,
      { status: 500 }
    );
  }
}

