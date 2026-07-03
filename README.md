# eddi-keyword-notifier

エッヂ（bbs.eddibb.cc）の板を5分毎に巡回し、キーワードに一致する新着スレのタイトルとURLをDiscordチャンネルへ投稿するCloudflare Worker。複数サーバーに導入でき、キーワードと通知先はサーバーごとに独立している。

## とにかくBOTを追加したい人（先着20サーバー）

自分でホストしなくても、稼働中のBOTをそのままサーバーに追加できます。

1. **[この招待リンク](https://discord.com/oauth2/authorize?client_id=1522262919054622730&permissions=3072&integration_type=0&scope=bot+applications.commands)** からBOTをサーバーに追加（要「サーバー管理」権限）
2. `/channel set` で通知先チャンネルを指定
3. `/keyword add <単語>` で通知したい単語を登録（スレタイに部分一致で通知）

登録は先着20サーバーまで。上限に達している場合は `/channel set` 時にお断りメッセージが返ります。

## 構成

```
GitHub (main) ─ push ─→ GitHub Actions（型チェック → テスト → デプロイ）
                              │
                              ▼
Cloudflare Worker
├─ scheduled()  Cron 5分毎: subject.txt取得 → 新着スレ抽出 → サーバーごとに照合・投稿
├─ fetch()      Discord HTTP Interactions: /channel set, /keyword add|remove|list
└─ KV (STATE)   guild:{サーバーID}: キーワード・通知先チャンネル / lastSeen: 判定済み最大スレ番号
```

## 仕様

- 照合対象は**新着スレのタイトルのみ**（部分一致、英字は大文字小文字を区別しない）
- 各スレは初出時に一度だけ判定するため、同一スレの重複投稿は発生しない（キーワード追加前のスレは通知しない）
- サーバー登録の入口は `/channel set`。登録サーバー数は `MAX_GUILDS`（20）まで、キーワードは1サーバーあたり `MAX_KEYWORDS`（20）まで
- 通知は1巡回・1サーバーにつき最大1メッセージ（ヒット5件までをまとめて掲載、超過分は「…ほかN件」）
- 通知先に到達できないサーバー（チャンネル削除・Bot退会等）は自動で登録解除
- コマンドは「サーバー管理」権限を持つメンバーのみ使用可能（サーバー設定 > 連携サービス でロール単位に変更可）

## シークレット・環境変数一覧

| 名前 | 設定先 | 取得元 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | ダッシュボード > プロファイル > APIトークン（下記「APIトークンの権限」参照） |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Secrets | ダッシュボード右サイドバー（または `npx wrangler whoami`） |
| `DISCORD_PUBLIC_KEY` | Worker Secret | Developer Portal > General Information > Public Key |
| `DISCORD_BOT_TOKEN` | Worker Secret と `.env` の両方 | Developer Portal > Bot > Token |
| `DISCORD_APP_ID` | `.env`（ローカルのみ） | Developer Portal > General Information > Application ID |

- **GitHub Secrets**: `gh secret set <名前>`（またはリポジトリ Settings > Secrets and variables > Actions）
- **Worker Secret**: `npx wrangler secret put <名前>`。ローカル実行（`wrangler dev`）では `.dev.vars.sample` をコピーした `.dev.vars` が使われる
- **`.env`**: `.env.sample` をコピーして作成。コマンド登録スクリプト（`npm run register`）専用

### APIトークンの権限

「Cloudflare Workersを編集する」テンプレートを開き、以下の4行だけ残して他はすべて削除する（Workersスクリプト権限はアカウント単位が最小粒度のため、Worker単体には絞れない）。アカウントリソースは対象アカウントに限定し、TTLを設定する。

- アカウント / Workers スクリプト / 編集
- アカウント / アカウント設定 / 読み取り
- ユーザー / ユーザーの詳細 / 読み取り
- ユーザー / メンバーシップ / 読み取り

## セットアップ

### 1. Discord側の準備

1. [Developer Portal](https://discord.com/developers/applications) でアプリを作成する
2. Bot > Public Bot は普段オフにし、招待URLを配る間だけオンにする

### 2. Cloudflare側の準備

```sh
npm install
npx wrangler login
npx wrangler kv namespace create STATE   # 出力された id を wrangler.jsonc に記入
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
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

### 5. サーバーへの導入（サーバーごと）

1. 招待URLでBotを追加する（`<APP_ID>` は Application ID に置換）:
   `https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=bot+applications.commands&permissions=3072`
   （permissions=3072 は「チャンネルを見る」+「メッセージを送信」）
2. `/channel set` で通知先チャンネルを設定する
3. `/keyword add <単語>` でキーワードを登録する

## 動作確認・運用

```sh
npx wrangler tail   # リアルタイムログ
```

毎巡回で `{"event":"crawl","newThreads":N,"guilds":[{"guildId":...,"hits":[...],"posted":N}]}` がログに出る。ダッシュボードの Worker > ログ（Workers Logs）でも検索できる。

## 開発

```sh
npm test            # 単体テスト
npm run typecheck   # 型チェック
npx wrangler dev --test-scheduled   # ローカルで scheduled を手動実行
```

## ライセンス

MIT
