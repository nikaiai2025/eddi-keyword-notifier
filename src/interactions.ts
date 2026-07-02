/**
 * interactions.ts — Discord HTTP Interactions（/keyword・/channel コマンド）
 *
 * Discord からの POST を Ed25519 署名検証し、スラッシュコマンドを処理する。
 * 設定はサーバー（guild）単位に分離され、応答はすべて ephemeral（実行者にのみ表示）。
 */

import { verifyKey } from "discord-interactions";
import type { Env } from "./env";
import { countGuilds, getGuild, putGuild } from "./guilds";

/** Interaction タイプ（Discord API 定義の抜粋） */
const PING = 1;
const APPLICATION_COMMAND = 2;
/** 応答タイプ */
const PONG = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;
/** メッセージフラグ: ephemeral */
const EPHEMERAL = 64;

interface CommandOption {
	name: string;
	value?: string;
	options?: CommandOption[];
}

interface Interaction {
	type: number;
	guild_id?: string;
	data?: {
		name: string;
		options?: CommandOption[];
	};
}

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
	});
}

function reply(content: string): Response {
	return json({
		type: CHANNEL_MESSAGE_WITH_SOURCE,
		data: { content, flags: EPHEMERAL },
	});
}

/** /channel のサブコマンドを実行し、応答メッセージを返す。 */
async function handleChannelCommand(
	env: Env,
	guildId: string,
	sub: CommandOption,
): Promise<string> {
	if (sub.name !== "set") return "不明なサブコマンドです。";

	const channelId = sub.options?.find((o) => o.name === "channel")?.value;
	if (!channelId) return "チャンネルを指定してください。";

	const existing = await getGuild(env.STATE, guildId);
	// 新規サーバーの登録はここが唯一の入口。上限に達していたら受け付けない
	if (!existing && (await countGuilds(env.STATE)) >= env.MAX_GUILDS) {
		return "登録サーバー数が上限に達しているため、新規登録できません。";
	}

	await putGuild(env.STATE, guildId, {
		keywords: existing?.keywords ?? [],
		channelId,
	});
	return `通知先を <#${channelId}> に設定しました。/keyword add でキーワードを登録してください。`;
}

/** /keyword のサブコマンドを実行し、応答メッセージを返す。 */
async function handleKeywordCommand(
	env: Env,
	guildId: string,
	sub: CommandOption,
): Promise<string> {
	const config = await getGuild(env.STATE, guildId);
	if (!config) {
		return "先に /channel set で通知先チャンネルを設定してください。";
	}

	const word = sub.options?.find((o) => o.name === "word")?.value?.trim();

	switch (sub.name) {
		case "add": {
			if (!word) return "キーワードを指定してください。";
			if (config.keywords.includes(word)) {
				return `「${word}」は登録済みです。`;
			}
			if (config.keywords.length >= env.MAX_KEYWORDS) {
				return `キーワードは1サーバーあたり${env.MAX_KEYWORDS}個までです。`;
			}
			await putGuild(env.STATE, guildId, {
				...config,
				keywords: [...config.keywords, word],
			});
			return `「${word}」を追加しました。`;
		}
		case "remove": {
			if (!word) return "キーワードを指定してください。";
			if (!config.keywords.includes(word)) {
				return `「${word}」は未登録です。`;
			}
			await putGuild(env.STATE, guildId, {
				...config,
				keywords: config.keywords.filter((k) => k !== word),
			});
			return `「${word}」を削除しました。`;
		}
		case "list":
			return config.keywords.length === 0
				? `通知先: <#${config.channelId}>\n登録済みキーワードはありません。`
				: `通知先: <#${config.channelId}>\n登録済みキーワード:\n${config.keywords.map((k) => `- ${k}`).join("\n")}`;
		default:
			return "不明なサブコマンドです。";
	}
}

export async function handleInteraction(
	request: Request,
	env: Env,
): Promise<Response> {
	const signature = request.headers.get("X-Signature-Ed25519");
	const timestamp = request.headers.get("X-Signature-Timestamp");
	const body = await request.text();

	const isValid =
		signature !== null &&
		timestamp !== null &&
		(await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
	if (!isValid) {
		return new Response("invalid request signature", { status: 401 });
	}

	const interaction = JSON.parse(body) as Interaction;

	if (interaction.type === PING) {
		return json({ type: PONG });
	}

	if (interaction.type === APPLICATION_COMMAND && interaction.data) {
		const guildId = interaction.guild_id;
		if (!guildId) return reply("サーバー内でのみ使用できます。");

		const sub = interaction.data.options?.[0];
		if (!sub) return reply("サブコマンドがありません。");

		switch (interaction.data.name) {
			case "channel":
				return reply(await handleChannelCommand(env, guildId, sub));
			case "keyword":
				return reply(await handleKeywordCommand(env, guildId, sub));
		}
	}

	return new Response("unhandled interaction", { status: 400 });
}
