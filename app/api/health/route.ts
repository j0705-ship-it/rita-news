import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const env: Record<string, string> = {};
    
    if (process.env.OPENAI_API_KEY) {
      const key = process.env.OPENAI_API_KEY;
      env.OPENAI_API_KEY = key.length > 8 
        ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
        : '***';
    } else {
      env.OPENAI_API_KEY = 'not set';
    }
    
    if (process.env.TZ) {
      env.TZ = process.env.TZ;
    } else {
      env.TZ = 'not set';
    }
    
    if (process.env.PRESET_KEYWORDS) {
      env.PRESET_KEYWORDS = process.env.PRESET_KEYWORDS;
    } else {
      env.PRESET_KEYWORDS = 'not set';
    }

    // KVストアの確認
    if (process.env.KV_REST_API_URL) {
      env.KV_REST_API_URL = 'set';
    } else {
      env.KV_REST_API_URL = 'not set';
    }

    if (process.env.KV_REST_API_TOKEN) {
      env.KV_REST_API_TOKEN = 'set';
    } else {
      env.KV_REST_API_TOKEN = 'not set';
    }

    return NextResponse.json({
      ok: true,
      env,
      time: new Date().toISOString()
    }, { status: 200 });
  } catch (error) {
    console.error('[HEALTH] エラー:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      time: new Date().toISOString()
    }, { status: 500 });
  }
}

