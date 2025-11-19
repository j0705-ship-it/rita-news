import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '業種別ニュース',
  description: '日本語のGoogle/Yahooニュースを業種別に取得・表示',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}



