# 業種別ニュースサイト

業種別の日本語ニュースを取得・要約・表示するシステムです。

## 機能

- 業種別ニュース取得（Google News / Yahoo News）
- OpenAIによる記事要約生成（60文字以内）
- Vercel KVによるキャッシュ（24時間TTL）
- Vercel Cronによる定期更新（毎日06:00 JST）
- Next.js App Router + Tailwind CSS
- 検索バー（カンマ区切りキーワード）

## クイックスタート

### 1. 依存関係のインストール

#### クリーンアップ（既存のnode_modulesがある場合）

依存関係の衝突を避けるため、既存の`node_modules`と`package-lock.json`を削除します：

**Linux/Mac:**
```bash
rm -rf node_modules package-lock.json
```

**Windows:**
```bash
rmdir /s /q node_modules
del package-lock.json
```

または、PowerShell:
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
```

#### インストール実行

```bash
npm install
```

インストールが失敗する場合（依存関係の衝突など）、以下のコマンドを試してください：

```bash
npm install --legacy-peer-deps
```

### 2. 環境変数の設定

`.env.example`を`.env.local`にコピー：

```bash
cp .env.example .env.local
```

または、Windowsの場合：

```bash
copy .env.example .env.local
```

`.env.local`を編集して、以下の必須キーを設定：

- **OPENAI_API_KEY** (必須): OpenAI API Key
  - 取得方法: https://platform.openai.com/api-keys
  - 例: `sk-...`

- **PRESET_KEYWORDS** (オプション): 初期表示キーワード（カンマ区切り）
  - デフォルト: `カフェ,美容室,ネイルサロン,まつげサロン,居酒屋,バー,パン屋,英会話スクール,ヨガスタジオ`

- **TZ** (オプション): タイムゾーン
  - デフォルト: `Asia/Tokyo`

### 3. ローカル開発サーバー起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開く

### 4. ヘルスチェック

別のターミナルで：

```bash
npm run health:local
```

または、ブラウザで `http://localhost:3000/api/health` を開く

## セットアップ（詳細）

### 環境変数（本番環境用）

Vercelダッシュボードで以下の環境変数を設定：

- `KV_REST_API_URL`: Vercel KV REST API URL
- `KV_REST_API_TOKEN`: Vercel KV REST API Token
- `OPENAI_API_KEY`: OpenAI API Key
- `CRON_SECRET`: Cron実行時の認証トークン（オプション）

### 3. Vercel KVのセットアップ

1. VercelダッシュボードでKVストアを作成
2. 環境変数を設定
3. 無料プラン: 読み取り10,000/日、書き込み1,000/日

### 4. ローカル開発

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開く

### 5. ビルドテスト

```bash
npm run build
```

### 6. デプロイ

```bash
vercel deploy
```

## Vercelデプロイ

### 1. プロジェクトの作成

1. Vercelダッシュボード（https://vercel.com）にログイン
2. 「Add New」→「Project」をクリック
3. GitHubリポジトリを選択（またはGitリポジトリをインポート）
4. プロジェクト設定で以下を確認：
   - Framework Preset: Next.js
   - Root Directory: `./`（プロジェクトルート）
   - Build Command: `npm run build`
   - Output Directory: `.next`

### 2. 環境変数の設定

**Project Settings > Environment Variables** で以下の環境変数を追加：

#### 必須環境変数

- **OPENAI_API_KEY** (必須)
  - 値: OpenAI API Key（`sk-...`形式）
  - 環境: Production, Preview, Development すべて
  - 取得方法: https://platform.openai.com/api-keys

#### オプション環境変数

- **PRESET_KEYWORDS** (オプション)
  - 値: `カフェ,美容室,ネイルサロン,まつげサロン,居酒屋,バー,パン屋,英会話スクール,ヨガスタジオ`
  - 環境: Production, Preview, Development すべて
  - 説明: 初期表示キーワード（カンマ区切り）

- **TZ** (オプション)
  - 値: `Asia/Tokyo`
  - 環境: Production, Preview, Development すべて
  - 説明: タイムゾーン設定

- **CRON_SECRET** (オプション)
  - 値: 任意の文字列（例: `your-secret-token-here`）
  - 環境: Production のみ
  - 説明: Cron実行時の認証トークン

### 3. Vercel KVのセットアップ

1. **KVストアの作成**
   - Vercelダッシュボード → **Storage** → **Create Database**
   - **KV** を選択
   - データベース名を入力（例: `rita-news-kv`）
   - リージョンを選択（推奨: `Tokyo (ap-northeast-1)`）

2. **プロジェクトへのバインディング**
   - プロジェクトの **Settings** → **Storage**
   - 作成したKVストアを選択
   - **Link to Project** をクリック
   - 環境変数が自動設定される：
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`

3. **使用箇所の確認**
   - `lib/kv-store.ts`: 記事データの保存・取得
   - `app/api/feed/route.ts`: キャッシュから記事取得
   - `app/api/cron/ingest/route.ts`: 記事データの保存
   - キー形式: `news:{keyword}:{YYYY-MM-DD}` (TTL: 24時間)

4. **制限事項**
   - 無料プラン: 読み取り10,000/日、書き込み1,000/日
   - データサイズ: 32MB/キー、512MB/データベース

### 4. Cron Jobの設定

1. **vercel.jsonの確認**
   - プロジェクトルートの `vercel.json` に以下が設定されていることを確認：
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/ingest",
         "schedule": "0 21 * * *"
       }
     ]
   }
   ```
   - スケジュール: `0 21 * * *` = 毎日21:00 UTC（06:00 JST）

2. **Cron Jobの有効化**
   - デプロイ後、Vercelダッシュボード → **Settings** → **Cron Jobs**
   - Cron Jobが自動的に作成される
   - ステータスが「Active」であることを確認

3. **手動実行（テスト）**
   - Vercelダッシュボード → **Deployments** → 最新のデプロイを選択
   - **Functions** → `/api/cron/ingest` を選択
   - 「Invoke」ボタンで手動実行可能

### 5. デプロイ実行

```bash
vercel deploy --prod
```

または、GitHubにプッシュすると自動デプロイされます。

### 6. デプロイ後の確認チェックリスト

#### 1) APIエンドポイントの動作確認

```bash
curl "https://your-project.vercel.app/api/feed?keywords=カフェ,美容室"
```

JSONレスポンスが返ることを確認。

#### 2) フロントエンドの表示確認

1. `https://your-project.vercel.app/` にアクセス
2. プリセットキーワードの記事一覧が表示されることを確認
3. 各記事にタイトル、要約、媒体名、日付が表示されることを確認

#### 3) 検索機能の動作確認

1. 検索バーに「カフェ,美容室」と入力
2. 「検索」ボタンをクリック
3. 新着記事が表示されることを確認
4. 更新時刻が表示されることを確認

#### 4) 自動更新の確認

**ログの確認方法:**

1. Vercelダッシュボード → **Deployments** → 最新のデプロイを選択
2. **Functions** → `/api/cron/ingest` を選択
3. **Logs** タブを開く
4. 次のログが表示されることを確認：
   ```
   [INGEST] 開始: 2024-01-01T21:00:00.000Z
   [INGEST] キーワード数: 9
   [INGEST] キーワード: カフェ, 美容室, ...
   [INGEST] 処理開始: カフェ
   [INGEST] カフェ: 取得件数 10件
   [INGEST] カフェ: フィルタ後 8件
   [INGEST] カフェ: 要約生成開始 (8件)
   [INGEST] カフェ: 要約生成完了 (8件)
   [INGEST] カフェ: KV保存開始 (8件)
   [INGEST] カフェ: KV保存完了
   [INGEST] カフェ: 処理完了 (2500ms)
   ...
   [INGEST] 完了: 成功 9/9、合計 180件、所要時間 25000ms
   ```

**手動実行で確認:**

1. Vercelダッシュボード → **Deployments** → 最新のデプロイを選択
2. **Functions** → `/api/cron/ingest` を選択
3. **Invoke** ボタンをクリック
4. レスポンスを確認：
   ```json
   {
     "success": true,
     "results": [
       {
         "keyword": "カフェ",
         "success": true,
         "count": 20
       },
       ...
     ],
     "summary": {
       "totalKeywords": 9,
       "successCount": 9,
       "totalArticles": 180,
       "duration": "25000ms"
     }
   }
   ```

#### 5) エラー時の確認

- ログに `[INGEST] エラー` が表示される場合:
  - 環境変数が正しく設定されているか確認
  - Vercel KVが正しくバインディングされているか確認
  - OpenAI API Keyが有効か確認
  - RSS取得が失敗していないか確認

### 7. トラブルシューティング

#### 問題: 環境変数が読み込まれない

**解決方法:**
1. Vercelダッシュボード → **Settings** → **Environment Variables**
2. 環境変数が正しく設定されているか確認
3. デプロイを再実行（環境変数変更後は再デプロイが必要）

#### 問題: Vercel KVにアクセスできない

**解決方法:**
1. Vercelダッシュボード → **Settings** → **Storage**
2. KVストアがプロジェクトにバインディングされているか確認
3. 環境変数 `KV_REST_API_URL` と `KV_REST_API_TOKEN` が自動設定されているか確認

#### 問題: Cron Jobが実行されない

**解決方法:**
1. Vercelダッシュボード → **Settings** → **Cron Jobs**
2. Cron Jobが「Active」であることを確認
3. `vercel.json` のスケジュール設定を確認
4. 手動実行で動作確認

#### 問題: 実行時間が10秒を超える

**解決方法:**
1. キーワード数を減らす（`PRESET_KEYWORDS`環境変数を調整）
2. 取得件数を減らす（`app/api/cron/ingest/route.ts`の`slice(0, 20)`を調整）
3. Vercel Proプランにアップグレード（60秒制限）

### 8. コスト監視

#### Vercel KV

- 無料プラン: 読み取り10,000/日、書き込み1,000/日
- 使用状況: Vercelダッシュボード → **Storage** → KVストア → **Usage**
- 超過時の対応: 読み取り/書き込み頻度を調整

#### OpenAI API

- 使用量: https://platform.openai.com/usage
- コスト: 1記事あたり約$0.001〜0.005（GPT-4o-mini）
- 監視: OpenAIダッシュボードで使用量を確認

#### Vercel Functions

- 無料プラン: 100GB時間/月
- 使用状況: Vercelダッシュボード → **Usage**
- 超過時の対応: 実行時間を最適化

## APIエンドポイント

### `GET /api/feed`

業種別の最新ニュースを取得（keywordsパラメータでカンマ区切り）

```
GET /api/feed?keywords=カフェ,美容室&limit=10
```

レスポンス:
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

### `GET /api/cron/ingest`

定期実行エンドポイント（Vercel Cronから呼び出し）

初期キーワード: カフェ、美容室、ネイルサロン、まつげサロン、居酒屋、バー、パン屋、英会話スクール、ヨガスタジオ

## コスト

- **Vercel KV**: 無料プラン（読み取り10,000/日、書き込み1,000/日）
- **OpenAI API**: GPT-4o-mini使用（1記事あたり約$0.001〜0.005）
- **Vercel Functions**: 無料プラン（100GB時間/月）

## 動作確認手順

### 1. ビルドテスト

```bash
npm run build
```

または

```bash
npm run check
```

正常に完了することを確認

### 2. ローカル開発サーバー起動

```bash
npm run dev
```

### 3. フィードAPI動作確認

サーバー起動中に、別のターミナルで：

**検証スクリプトを使用（推奨）:**
```bash
npm run check:feed "カフェ,美容室" 10
```

出力例：
```
📡 リクエスト: http://localhost:3000/api/feed?keywords=カフェ,美容室&limit=10

✅ 取得成功

📊 セクション概要:
  - カフェ: 5件
  - 美容室: 5件

📈 合計: 10件
🕐 更新時刻: 2024-01-01T00:00:00.000Z

📰 サンプル記事（最初の3件）:
  ...
```

**curlを使用:**
```bash
curl "http://localhost:3000/api/feed?keywords=カフェ,美容室&limit=10"
```

### 4. ヘルスチェック

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

### 5. ブラウザで確認

1. `http://localhost:3000` を開く
2. 初期キーワードの記事一覧が表示されることを確認
3. 検索バーに「カフェ,美容室」と入力して検索
4. 記事が表示されることを確認

### 6. APIエンドポイントテスト（詳細）

```bash
curl "http://localhost:3000/api/feed?keywords=カフェ,美容室"
```

JSONレスポンスが返ることを確認

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

## デバッグ方法

### 1. ヘルスチェック

環境変数の設定状況を確認：

```bash
curl http://localhost:3000/api/health
```

レスポンス例：
```json
{
  "ok": true,
  "env": {
    "OPENAI_API_KEY": "sk-1...abcd",
    "TZ": "Asia/Tokyo",
    "PRESET_KEYWORDS": "カフェ,美容室,...",
    "KV_REST_API_URL": "set",
    "KV_REST_API_TOKEN": "set"
  },
  "time": "2024-01-01T00:00:00.000Z"
}
```

### 2. フィードAPIの動作確認

```bash
curl "http://localhost:3000/api/feed?keywords=美容室,カフェ&limit=5"
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
      "category": "美容室"
    }
  ],
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 3. ターミナルログの確認

`npm run dev` 実行中のターミナルで、以下のログが表示されます：

**正常時:**
```
[FEED] リクエスト開始: 2024-01-01T00:00:00.000Z
[FEED] パラメータ: keywords=美容室,カフェ, limit=5
[FEED] 処理キーワード: 美容室, カフェ
[FEED] キーワード処理開始: 美容室
[RSS] 取得開始: 美容室
[RSS] 取得完了: 美容室 - 10件
[FEED] フィルタ後: 美容室 - 8件
[FEED] 要約生成開始: 美容室 - 8件
[FEED] 要約生成完了: 美容室 - 8件
[FEED] キーワード処理完了: 美容室 - 8件
[FEED] 処理完了: 合計 16件、所要時間 5000ms
```

**エラー時:**
```
[FEED] RSS取得エラー: 美容室 Error: timeout
[FEED] スタック: Error: timeout
    at ...
[FEED] 記事なし: 美容室
[FEED] 処理完了: 合計 0件、所要時間 3000ms
```

### 4. よくある問題と対処法

#### 問題: 記事が0件

**確認事項:**
1. ログで `[RSS] 取得完了` を確認
2. ログで `[FEED] フィルタ後` を確認
3. 同義語での再試行が行われているか確認

**対処法:**
- キーワードを変更して再試行
- ログでエラーメッセージを確認

#### 問題: 要約が生成されない

**確認事項:**
1. `/api/health` で `OPENAI_API_KEY` が設定されているか確認
2. ログで `[FEED] 要約生成エラー` を確認

**対処法:**
- `OPENAI_API_KEY` を設定
- API Keyが有効か確認
- ログでエラーメッセージを確認

#### 問題: タイムアウトエラー

**確認事項:**
1. ログで `[RSS] タイムアウト` を確認
2. ネットワーク接続を確認

**対処法:**
- ネットワーク接続を確認
- 再試行（キャッシュから取得される可能性あり）

## 注意事項

- Vercel Cronの無料プランは実行時間10秒制限（Proプランは60秒）
- OpenAI APIのコストは記事数に応じて変動（1記事あたり約$0.001〜0.005）
- RSS取得失敗時はキャッシュから表示、キャッシュもない場合は空配列を返す
- 要約は60文字以内に制限（OPENAI_API_KEYがない場合は要約なし）
- Vercel KVの無料プランは読み取り10,000/日、書き込み1,000/日
- RSS取得は8秒でタイムアウト
- エラー時もHTTP 200を返す（開発環境ではdebugメッセージを含む）

## ライセンス

MIT

