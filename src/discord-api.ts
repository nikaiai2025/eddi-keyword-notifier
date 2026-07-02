/** discord-api.ts — Bot トークンによるチャンネル投稿 */

/**
 * チャンネルへメッセージを投稿する。
 * 戻り値 "gone" は到達不能（チャンネル削除・Bot退会・権限喪失）を表し、
 * 呼び出し側でサーバー登録解除の契機とする。
 */
export async function postChannelMessage(
	botToken: string,
	channelId: string,
	content: string,
): Promise<"ok" | "gone"> {
	const response = await fetch(
		`https://discord.com/api/v10/channels/${channelId}/messages`,
		{
			method: "POST",
			headers: {
				Authorization: `Bot ${botToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ content }),
		},
	);
	if (response.status === 403 || response.status === 404) return "gone";
	if (!response.ok) {
		throw new Error(`channel post failed (${response.status})`);
	}
	return "ok";
}
