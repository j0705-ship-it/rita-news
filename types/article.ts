export interface Article {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  category: string;
  fetchedAt: string;
}

export interface ArticleWithSummary extends Article {
  summary: string;
  summaryTitle?: string;
}

export interface IngestResult {
  category: string;
  success: boolean;
  count: number;
  error?: string;
}

export interface IngestRequest {
  keywords: string[];
  category: string;
}

export interface SummaryRequest {
  articles: Article[];
}

export interface SummaryResponse {
  articles: ArticleWithSummary[];
}

export interface FeedResponse {
  articles: ArticleWithSummary[];
  updatedAt: string;
  message?: string;
  debug?: string;
  error?: string;
}

