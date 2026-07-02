/** Worker のバインディング定義 */
export interface Env {
	/** 巡回状態・サーバー別設定を保持する KV */
	STATE: KVNamespace;
	/** 巡回対象の subject.txt URL（wrangler.jsonc の vars） */
	SOURCE_URL: string;
	/** 登録可能なサーバー数の上限（wrangler.jsonc の vars） */
	MAX_GUILDS: number;
	/** 1サーバーあたりのキーワード数上限（wrangler.jsonc の vars） */
	MAX_KEYWORDS: number;
	/** Discord アプリの公開鍵（Interactions 署名検証用 Secret） */
	DISCORD_PUBLIC_KEY: string;
	/** Bot トークン（チャンネル投稿用 Secret） */
	DISCORD_BOT_TOKEN: string;
}
