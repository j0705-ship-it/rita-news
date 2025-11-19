import { NextRequest, NextResponse } from 'next/server';
import { fetchNews } from '../../lib/news-fetcher';
import { filterArticles } from '../../lib/article-normalizer';
import { getKeywords } from '../../lib/category-keywords';
import { saveArticles } from '../../lib/kv-store';
import { IngestRequest, IngestResult } from '../../types/article';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body: IngestRequest = await request.json();
    const { keywords, category } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid keywords' },
        { status: 400 }
      );
    }

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    const allKeywords = keywords.length > 0 ? keywords : getKeywords(category);
    const scope = 'jp';

    let articles;
    try {
      articles = await fetchNews(allKeywords, category, scope);
    } catch (error) {
      console.error(`Failed to fetch news for ${category}:`, error);
      return NextResponse.json({
        success: false,
        count: 0,
        category,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as IngestResult);
    }

    const filtered = filterArticles(articles, category);
    const limited = filtered.slice(0, 50);

    if (limited.length > 0) {
      try {
        await saveArticles(category, limited);
      } catch (error) {
        console.error(`Failed to save articles for ${category}:`, error);
        return NextResponse.json({
          success: false,
          count: 0,
          category,
          error: error instanceof Error ? error.message : 'Failed to save'
        } as IngestResult);
      }
    }

    return NextResponse.json({
      success: true,
      count: limited.length,
      category
    } as IngestResult);
  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      {
        success: false,
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as IngestResult,
      { status: 500 }
    );
  }
}

