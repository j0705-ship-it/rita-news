# 変更ファイル一覧

## 新規作成ファイル

### Next.js App Router構造
- `app/layout.tsx` - ルートレイアウト
- `app/page.tsx` - メインページ（フロントエンド）
- `app/globals.css` - Tailwind CSSスタイル
- `app/api/feed/route.ts` - フィードAPI（keywordsパラメータ対応）
- `app/api/cron/ingest/route.ts` - 定期実行エンドポイント

### 設定ファイル
- `next.config.js` - Next.js設定
- `tailwind.config.js` - Tailwind CSS設定
- `postcss.config.js` - PostCSS設定
- `.eslintrc.json` - ESLint設定

### ドキュメント
- `CHANGES.md` - 変更ファイル一覧（このファイル）
- `README.md` - 更新（動作確認手順追加）

## 修正ファイル

### パッケージ管理
- `package.json` - Next.js、React、Tailwind CSS追加

### TypeScript設定
- `tsconfig.json` - Next.js App Router用に更新

### ライブラリ
- `lib/openai-client.ts` - 要約を60文字以内に制限
- `lib/kv-store.ts` - キーワードベースの保存に変更
- `lib/article-normalizer.ts` - キーワードベースのフィルタリングに変更

### Vercel設定
- `vercel.json` - App Router用に更新

## 削除ファイル（既存のapi/ディレクトリ）

既存の`api/`ディレクトリは`app/api/`に移動しました。

## 実装内容

### 1. フロントエンド（app/page.tsx）
- Tailwind CSSでスタイリング
- 検索バー（カンマ区切りキーワード入力）
- 業種ごとのセクション見出し
- 記事カード（タイトル、要約、媒体、日付）
- 最終更新日時表示
- 初期キーワード表示

### 2. APIエンドポイント（app/api/feed/route.ts）
- `keywords`パラメータでカンマ区切りキーワードを受け取り
- 各キーワードごとにニュース取得
- KVストアからキャッシュ取得、なければ都度取得
- OpenAI要約生成（60文字以内）
- 業種ごとにグループ化して返却

### 3. 定期実行（app/api/cron/ingest/route.ts）
- 初期キーワードで毎日06:00 JSTに実行
- 各キーワードごとにニュース取得・要約・保存

### 4. 要約生成（lib/openai-client.ts）
- 60文字以内の要約に制限
- フォールバック処理（OpenAI API未設定時）

### 5. データ保存（lib/kv-store.ts）
- キーワードベースで保存
- 24時間TTL

## 動作確認手順

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数設定
`.env.local`ファイルを作成：
```
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token
OPENAI_API_KEY=your_openai_api_key
CRON_SECRET=your_cron_secret (オプション)
```

### 3. ビルドテスト
```bash
npm run build
```
正常に完了することを確認

### 4. ローカル開発サーバー起動
```bash
npm run dev
```

### 5. ブラウザで確認
1. `http://localhost:3000` を開く
2. 初期キーワードの記事一覧が表示されることを確認
3. 検索バーに「カフェ,美容室」と入力して検索
4. 記事が表示されることを確認

### 6. APIエンドポイントテスト
```bash
curl "http://localhost:3000/api/feed?keywords=カフェ,美容室"
```
JSONレスポンスが返ることを確認

## 完了条件

- ✅ `npm run build` が正常に完了
- ✅ `/api/feed?keywords=カフェ,美容室` がJSONを返す
- ✅ `/` にアクセスするとプリセット記事一覧が表示される
- ✅ 検索バーで任意キーワードを入力すると新着が表示される



