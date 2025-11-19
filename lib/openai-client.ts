import OpenAI from 'openai';
import { Article, ArticleWithSummary } from '../types/article';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateSummary(
  article: Article
): Promise<{ title: string; summary: string }> {
  if (!process.env.OPENAI_API_KEY) {
    const fallbackSummary = article.description.split(/[。\.]/)[0] || article.description.slice(0, 60);
    return {
      title: article.title,
      summary: fallbackSummary.length > 60 ? fallbackSummary.slice(0, 57) + '...' : fallbackSummary
    };
  }

  try {
    const prompt = `以下の記事の1文要約（日本語、60文字以内）を生成してください。

タイトル: ${article.title}
本文: ${article.description.slice(0, 500)}

出力形式:
要約: [60文字以内の1文要約]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'あなたは日本語のニュース記事を要約する専門家です。要約は60文字以内で1文にまとめてください。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    const content = response.choices[0]?.message?.content || '';
    const summaryMatch = content.match(/要約[：:]\s*(.+)/);
    let summary = summaryMatch ? summaryMatch[1].trim() : article.description.split(/[。\.]/)[0] || article.description.slice(0, 60);
    
    if (summary.length > 60) {
      summary = summary.slice(0, 57) + '...';
    }

    return {
      title: article.title,
      summary: summary
    };
  } catch (error) {
    console.error('Failed to generate summary:', error);
    const fallbackSummary = article.description.split(/[。\.]/)[0] || article.description.slice(0, 60);
    return {
      title: article.title,
      summary: fallbackSummary.length > 60 ? fallbackSummary.slice(0, 57) + '...' : fallbackSummary
    };
  }
}

export async function generateSummaries(
  articles: Article[]
): Promise<ArticleWithSummary[]> {
  if (!process.env.OPENAI_API_KEY) {
    return articles.map(article => {
      const fallbackSummary = article.description.split(/[。\.]/)[0] || article.description.slice(0, 60);
      return {
        ...article,
        summary: fallbackSummary.length > 60 ? fallbackSummary.slice(0, 57) + '...' : fallbackSummary
      };
    });
  }

  const results: ArticleWithSummary[] = [];
  const batchSize = 5;
  const maxArticles = 20;

  const articlesToProcess = articles.slice(0, maxArticles);

  for (let i = 0; i < articlesToProcess.length; i += batchSize) {
    const batch = articlesToProcess.slice(i, i + batchSize);
    const promises = batch.map(async (article) => {
      try {
        const { title, summary } = await generateSummary(article);
        return {
          ...article,
          summaryTitle: title,
          summary
        } as ArticleWithSummary;
      } catch (error) {
        console.error(`Failed to generate summary for article ${article.id}:`, error);
        const fallbackSummary = article.description.split(/[。\.]/)[0] || article.description.slice(0, 60);
        return {
          ...article,
          summary: fallbackSummary.length > 60 ? fallbackSummary.slice(0, 57) + '...' : fallbackSummary
        } as ArticleWithSummary;
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    if (i + batchSize < articlesToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

