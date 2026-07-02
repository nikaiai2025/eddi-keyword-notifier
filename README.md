# bbs-keyword-notifier

エッヂ（bbs.eddibb.cc）の板を5分毎に巡回し、キーワードに一致する新着スレのタイトルとURLをDiscordチャンネルへ投稿するCloudflare Worker。

## 構成

```
GitHub (main) ─ push ─→ GitHub Actions（型チェック → テスト → デプロイ）
                              │
                              ▼
Cloudflare Worker
├─ scheduled()  Cron 5分毎: subject.txt取得 → 新着スレ抽出 → キーワード照合 → Webhook投稿
├─ fetch()      Discord HTTP Interactions: /keyword add|remove|list
└─ KV (STATE)   keywords: キーワード配列 / lastSeen: 判定済み最大スレ番号
```

## 仕様

- 照合対象は**新着スレのタイトルのみ**（部分一致、英字は大文字小文字を区別しない）
- 各スレは初出時に一度だけ判定するため、同一スレの重複投稿は発生しない
- キーワード追加時点で既に存在するスレは通知しない
- 初回実行は基準点の記録のみ行い、通知しない
- `/keyword` は「サーバー管理」権限を持つメンバーのみ使用可能（サーバー設定 > 連携サービス でロール単位に変更可）

## シークレット・環境変数一覧

| 名前 | 設定先 | 取得元 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | ダッシュボード > プロファイル > APIトークン（「Cloudflare Workersを編集する」テンプレート） |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Secrets | ダッシュボード右サイドバー（または `npx wrangler whoami`） |
| `DISCORD_PUBLIC_KEY` | Worker Secret | Developer Portal > General Information > Public Key |
| `DISCORD_WEBHOOK_URL` | Worker Secret | 通知先チャンネルの設定 > 連携サービス > ウェブフック |
| `DISCORD_APP_ID` | `.env`（ローカルのみ） | Developer Portal > General Information > Application ID |
| `DISCORD_BOT_TOKEN` | `.env`（ローカルのみ） | Developer Portal > Bot > Token |

- **GitHub Secrets**: `gh secret set <名前>`（またはリポジトリ Settings > Secrets and variables > Actions）
- **Worker Secret**: `npx wrangler secret put <名前>`。ローカル実行（`wrangler dev`）では `.dev.vars.sample` をコピーした `.dev.vars` が使われる
- **`.env`**: `.env.sample` をコピーして作成。コマンド登録スクリプト（`npm run register`）専用

## セットアップ

### 1. Discord側の準備

1. [Developer Portal](https://discord.com/developers/applications) でアプリを作成する
2. 通知先チャンネルの設定 > 連携サービス > ウェブフックでWebhook URLを発行する
3. OAuth2 > URL Generator で scope `applications.commands` のURLを生成し、Botをサーバーに招待する

### 2. Cloudflare側の準備

```sh
npm install
npx wrangler login
npx wrangler kv namespace create STATE   # 出力された id を wrangler.jsonc に記入
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_WEBHOOK_URL
```

### 3. デプロイ（GitHub Actions）

```sh
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```

mainへのpushで自動デプロイされる（手動デプロイは `npm run deploy`）。デプロイ後、workers.devのURLを控える。

### 4. コマンド登録とエンドポイント設定

1. `.env.sample` をコピーして `.env` を作成し、値を埋めて `npm run register`
2. Developer Portal > General Information の **Interactions Endpoint URL** にWorkerのURLを設定する（保存時にDiscordがPING検証を行うため、デプロイ後に設定すること）

### 5. 動作確認

```sh
npx wrangler tail   # ログ監視
```

- Discordで `/keyword add <単語>` → 「追加しました」が返ること
- 次のCron実行ログでエラーが出ていないこと（subject.txt取得とShift_JISデコードの確認）

## 開発

```sh
npm test            # 単体テスト
npm run typecheck   # 型チェック
npx wrangler dev --test-scheduled   # ローカルで scheduled を手動実行
```
