'use client'

import { useState, useEffect } from 'react'
import { ArticleWithSummary } from '@/types/article'
import { format, parseISO } from 'date-fns'

const DEFAULT_KEYWORDS = ['カフェ', '美容室', 'ネイルサロン', 'まつげサロン', '居酒屋', 'バー', 'パン屋', '英会話スクール', 'ヨガスタジオ']

const getInitialKeywords = (): string[] => {
  return DEFAULT_KEYWORDS
}

export default function Home() {
  const [articles, setArticles] = useState<Record<string, ArticleWithSummary[]>>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [updatedAt, setUpdatedAt] = useState<string>('')
  const [searchKeywords, setSearchKeywords] = useState<string>('')

  useEffect(() => {
    loadInitialArticles()
  }, [])

  const loadInitialArticles = async () => {
    setLoading(true)
    try {
      const keywords = getInitialKeywords()
      const keywordsStr = keywords.join(',')
      const response = await fetch(`/api/feed?keywords=${encodeURIComponent(keywordsStr)}&limit=10`)
      const data = await response.json()
      
      if (data.articles) {
        const grouped: Record<string, ArticleWithSummary[]> = {}
        data.articles.forEach((article: ArticleWithSummary) => {
          const category = article.category || 'その他'
          if (!grouped[category]) {
            grouped[category] = []
          }
          grouped[category].push(article)
        })
        setArticles(grouped)
        setUpdatedAt(data.updatedAt || new Date().toISOString())
      }
    } catch (error) {
      console.error('Failed to load articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchKeywords.trim()) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/feed?keywords=${encodeURIComponent(searchKeywords)}&limit=10`)
      const data = await response.json()
      
      if (data.articles) {
        const grouped: Record<string, ArticleWithSummary[]> = {}
        data.articles.forEach((article: ArticleWithSummary) => {
          const category = article.category || 'その他'
          if (!grouped[category]) {
            grouped[category] = []
          }
          grouped[category].push(article)
        })
        setArticles(grouped)
        setUpdatedAt(data.updatedAt || new Date().toISOString())
      }
    } catch (error) {
      console.error('Failed to search articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString)
      return format(date, 'yyyy年MM月dd日 HH:mm')
    } catch {
      try {
        return format(new Date(dateString), 'yyyy年MM月dd日 HH:mm')
      } catch {
        return dateString
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">業種別ニュース</h1>
          <p className="text-sm text-gray-600 mt-1">日本語のGoogle/Yahooニュースを業種別に取得・表示</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchKeywords}
              onChange={(e) => setSearchKeywords(e.target.value)}
              placeholder="業種をカンマ区切りで入力（例: カフェ,美容室）"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              検索
            </button>
            <button
              onClick={loadInitialArticles}
              disabled={loading}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              初期表示
            </button>
          </div>
          {updatedAt && (
            <p className="text-sm text-gray-500 mt-2">
              最終更新: {formatDate(updatedAt)}
            </p>
          )}
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">読み込み中...</p>
          </div>
        )}

        {!loading && Object.keys(articles).length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600">記事が見つかりませんでした</p>
          </div>
        )}

        {!loading && Object.keys(articles).map((category) => (
          <section key={category} className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">
              {category}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {articles[category].map((article) => (
                <article
                  key={article.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 hover:underline"
                    >
                      {article.title}
                    </a>
                  </h3>
                  {article.summary && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{article.source}</span>
                    <span>{formatDate(article.pubDate)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-gray-600 text-center">
            出典: Google News / Yahoo News
          </p>
        </div>
      </footer>
    </div>
  )
}

