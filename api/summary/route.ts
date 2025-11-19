import { NextRequest, NextResponse } from 'next/server';
import { generateSummaries } from '../../lib/openai-client';
import { SummaryRequest, SummaryResponse } from '../../types/article';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body: SummaryRequest = await request.json();
    const { articles } = body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: 'Invalid articles array' },
        { status: 400 }
      );
    }

    if (articles.length > 20) {
      return NextResponse.json(
        { error: 'Too many articles. Maximum 20 articles per request.' },
        { status: 400 }
      );
    }

    const articlesWithSummary = await generateSummaries(articles);

    return NextResponse.json({
      articles: articlesWithSummary
    } as SummaryResponse);
  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        articles: []
      } as SummaryResponse,
      { status: 500 }
    );
  }
}

