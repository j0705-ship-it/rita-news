import { NextRequest, NextResponse } from 'next/server';
import { getAllCategories, getKeywords } from '../../lib/category-keywords';
import { IngestResult } from '../../types/article';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const categories = getAllCategories();
    const results: IngestResult[] = [];
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    for (const category of categories) {
      try {
        const keywords = getKeywords(category);
        
        const response = await fetch(`${baseUrl}/api/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            keywords,
            category
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result: IngestResult = await response.json();
        results.push(result);
        
        console.log(`Ingested ${result.count} articles for ${category}`);

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to ingest ${category}:`, error);
        results.push({
          category,
          success: false,
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.reduce((sum, r) => sum + r.count, 0);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalCategories: categories.length,
        successCount,
        totalArticles: totalCount
      }
    });
  } catch (error) {
    console.error('Cron ingest error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

