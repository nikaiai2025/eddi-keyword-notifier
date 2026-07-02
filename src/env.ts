/** Worker のバインディング定義 */
export interface Env {
	/** 巡回状態・キーワードを保持する KV */
	STATE: KVNamespace;
	/** 巡回対象の subject.txt URL（wrangler.jsonc の vars） */
	SOURCE_URL: string;
	/** Discord アプリの公開鍵（Interactions 署名検証用 Secret） */
	DISCORD_PUBLIC_KEY: string;
	/** 通知先チャンネルの Webhook URL（Secret） */
	DISCORD_WEBHOOK_URL: string;
}
