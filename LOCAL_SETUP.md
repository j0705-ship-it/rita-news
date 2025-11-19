# ローカル動作手順

## 1. 依存関係のインストール

```bash
npm install
```

## 2. 環境変数の設定

`.env.example`を`.env.local`にコピー：

**Linux/Mac:**
```bash
cp .env.example .env.local
```

**Windows:**
```bash
copy .env.example .env.local
```

`.env.local`を編集して、以下の必須キーを設定：

```env
OPENAI_API_KEY=sk-your-actual-key-here
PRESET_KEYWORDS=カフェ,美容室,ネイルサロン,まつげサロン,居酒屋,バー,パン屋,英会話スクール,ヨガスタジオ
TZ=Asia/Tokyo
```

### 必須キーの説明

- **OPENAI_API_KEY** (必須): OpenAI API Key
  - 取得方法: https://platform.openai.com/api-keys
  - 例: `sk-...`

- **PRESET_KEYWORDS** (オプション): 初期表示キーワード（カンマ区切り）
  - デフォルト: `カフェ,美容室,ネイルサロン,まつげサロン,居酒屋,バー,パン屋,英会話スクール,ヨガスタジオ`

- **TZ** (オプション): タイムゾーン
  - デフォルト: `Asia/Tokyo`

## 3. ローカル開発サーバー起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開く

## 4. ヘルスチェック

別のターミナルで：

```bash
npm run health:local
```

または、curlで：

```bash
curl http://localhost:3000/api/health
```

期待されるレスポンス：
```json
{
  "ok": true,
  "env": {
    "OPENAI_API_KEY": "sk-1...abcd",
    "TZ": "Asia/Tokyo",
    "PRESET_KEYWORDS": "カフェ,美容室,..."
  },
  "time": "2024-01-01T00:00:00.000Z"
}
```

## 5. APIエンドポイントテスト

### フィードAPI

```bash
curl "http://localhost:3000/api/feed?keywords=カフェ,美容室"
```

レスポンス例：
```json
{
  "articles": [
    {
      "id": "...",
      "title": "...",
      "link": "...",
      "summary": "60文字以内の要約",
      "source": "...",
      "pubDate": "...",
      "category": "カフェ"
    }
  ],
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### ヘルスAPI

```bash
curl http://localhost:3000/api/health
```

## 6. ビルドテスト

```bash
npm run build
```

または

```bash
npm run check
```

正常に完了することを確認



