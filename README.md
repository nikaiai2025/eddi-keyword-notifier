# bbs-keyword-notifier

エッヂ（bbs.eddibb.cc）の板を5分毎に巡回し、キーワードに一致する新着スレのタイトルとURLをDiscordチャンネルへ投稿するCloudflare Worker。

## 構成

```
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

## セットアップ

### 1. Discord側の準備

1. [Developer Portal](https://discord.com/developers/applications) でアプリを作成し、General Information の **Application ID** と **Public Key** を控える
2. Bot タブで **Bot Token** を控える
3. 通知先チャンネルの設定 > 連携サービス > ウェブフックで **Webhook URL** を発行
4. OAuth2 > URL Generator で scope `applications.commands` のURLを生成し、Botをサーバーに招待

### 2. Cloudflareへのデプロイ

```sh
npm install
npx wrangler login
npx wrangler kv namespace create STATE   # 出力された id を wrangler.jsonc に記入
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_WEBHOOK_URL
npm run deploy                           # 出力される workers.dev URL を控える
```

### 3. コマンド登録とエンドポイント設定

```sh
# PowerShell
$env:DISCORD_APP_ID = "..."; $env:DISCORD_BOT_TOKEN = "..."; npm run register
```

Developer Portal > General Information の **Interactions Endpoint URL** にWorkerのURLを設定する（保存時にDiscordがPING検証を行うため、デプロイ後に設定すること）。

### 4. 動作確認

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
