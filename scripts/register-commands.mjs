/**
 * register-commands.mjs — スラッシュコマンド定義の登録（初回・定義変更時のみ実行）
 *
 * 使い方:
 *   .env.sample をコピーして .env を作成し、値を埋めて `npm run register`
 *
 * default_member_permissions: "32" は「サーバー管理」権限。
 * この権限を持たないメンバーにはコマンドが表示されない。
 * ロール単位の調整はサーバー設定 > 連携サービス から行う。
 */

const appId = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_TOKEN;

if (!appId || !token) {
	console.error("DISCORD_APP_ID / DISCORD_BOT_TOKEN を環境変数に設定してください。");
	process.exit(1);
}

const commands = [
	{
		name: "channel",
		description: "通知先チャンネルの管理",
		default_member_permissions: "32",
		contexts: [0], // サーバー内でのみ使用可（DM 不可）
		options: [
			{
				type: 1, // SUB_COMMAND
				name: "set",
				description: "通知先チャンネルを設定する（サーバー登録の入口）",
				options: [
					{
						type: 7, // CHANNEL
						name: "channel",
						description: "通知を投稿するチャンネル",
						required: true,
						channel_types: [0, 5], // テキスト / アナウンス
					},
				],
			},
		],
	},
	{
		name: "keyword",
		description: "このサーバーの巡回キーワードの管理",
		default_member_permissions: "32",
		contexts: [0],
		options: [
			{
				type: 1,
				name: "add",
				description: "キーワードを追加する",
				options: [
					{
						type: 3, // STRING
						name: "word",
						description: "追加する単語",
						required: true,
					},
				],
			},
			{
				type: 1,
				name: "remove",
				description: "キーワードを削除する",
				options: [
					{
						type: 3,
						name: "word",
						description: "削除する単語",
						required: true,
					},
				],
			},
			{
				type: 1,
				name: "list",
				description: "通知先と登録済みキーワードの一覧を表示する",
			},
		],
	},
];

const response = await fetch(
	`https://discord.com/api/v10/applications/${appId}/commands`,
	{
		method: "PUT",
		headers: {
			Authorization: `Bot ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(commands),
	},
);

if (!response.ok) {
	console.error(`登録失敗 (${response.status}):`, await response.text());
	process.exit(1);
}

console.log("スラッシュコマンドを登録しました。");
