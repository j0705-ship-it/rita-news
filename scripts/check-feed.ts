#!/usr/bin/env node

/**
 * /api/feed の動作確認用スクリプト
 * 
 * 使用方法:
 *   npm run check:feed "カフェ,美容室" 10
 * 
 * 引数:
 *   keywords: カンマ区切りのキーワード（必須）
 *   limit: 取得件数（オプション、デフォルト: 10）
 */

// Node.js 18+ の組み込みfetchを使用
declare global {
  function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('使用方法: npm run check:feed "keywords" [limit]');
  console.error('例: npm run check:feed "カフェ,美容室" 10');
  process.exit(1);
}

const keywords = args[0];
const limit = args[1] ? parseInt(args[1], 10) : 10;
const baseUrl = process.env.API_URL || 'http://localhost:3000';

async function checkFeed() {
  try {
    const url = `${baseUrl}/api/feed?keywords=${encodeURIComponent(keywords)}&limit=${limit}`;
    console.log(`\n📡 リクエスト: ${url}\n`);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ エラー: HTTP ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`レスポンス: ${text}`);
      process.exit(1);
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      console.log('⚠️  記事が見つかりませんでした');
      console.log(`更新時刻: ${data.updatedAt || 'N/A'}`);
      return;
    }

    // キーワードごとの件数を集計
    const sections: Record<string, number> = {};
    data.articles.forEach((article: { category: string }) => {
      const category = article.category || 'その他';
      sections[category] = (sections[category] || 0) + 1;
    });

    console.log('✅ 取得成功\n');
    console.log('📊 セクション概要:');
    Object.entries(sections).forEach(([keyword, count]) => {
      console.log(`  - ${keyword}: ${count}件`);
    });

    console.log(`\n📈 合計: ${data.articles.length}件`);
    console.log(`🕐 更新時刻: ${data.updatedAt || 'N/A'}`);

    // サンプル記事を表示
    console.log('\n📰 サンプル記事（最初の3件）:');
    data.articles.slice(0, 3).forEach((article: { title: string; category: string; summary: string; source: string; pubDate: string }, index: number) => {
      console.log(`\n  ${index + 1}. [${article.category}] ${article.title}`);
      if (article.summary) {
        console.log(`     要約: ${article.summary}`);
      }
      console.log(`     媒体: ${article.source || 'N/A'}`);
      console.log(`     日付: ${article.pubDate || 'N/A'}`);
    });

    if (data.articles.length > 3) {
      console.log(`\n  ... 他 ${data.articles.length - 3}件`);
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ エラーが発生しました:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      if (error.message.includes('fetch')) {
        console.error('\n💡 ヒント: サーバーが起動しているか確認してください');
        console.error('   npm run dev でサーバーを起動してから再試行してください');
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

checkFeed();

