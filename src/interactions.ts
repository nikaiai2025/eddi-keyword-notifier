/**
 * interactions.ts — Discord HTTP Interactions（/keyword コマンド）
 *
 * Discord からの POST を Ed25519 署名検証し、スラッシュコマンドを処理する。
 * 応答はすべて ephemeral（実行者にのみ表示）。
 */

import { verifyKey } from "discord-interactions";
import type { Env } from "./env";
import { getKeywords, saveKeywords } from "./keywords";

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

/** /keyword のサブコマンドを実行し、応答メッセージを返す。 */
export async function executeKeywordCommand(
	kv: KVNamespace,
	subcommand: string,
	word: string | undefined,
): Promise<string> {
	const keywords = await getKeywords(kv);

	switch (subcommand) {
		case "add": {
			const trimmed = word?.trim();
			if (!trimmed) return "キーワードを指定してください。";
			if (keywords.includes(trimmed)) {
				return `「${trimmed}」は登録済みです。`;
			}
			await saveKeywords(kv, [...keywords, trimmed]);
			return `「${trimmed}」を追加しました。`;
		}
		case "remove": {
			const trimmed = word?.trim();
			if (!trimmed) return "キーワードを指定してください。";
			if (!keywords.includes(trimmed)) {
				return `「${trimmed}」は未登録です。`;
			}
			await saveKeywords(
				kv,
				keywords.filter((k) => k !== trimmed),
			);
			return `「${trimmed}」を削除しました。`;
		}
		case "list":
			return keywords.length === 0
				? "登録済みキーワードはありません。"
				: `登録済みキーワード:\n${keywords.map((k) => `- ${k}`).join("\n")}`;
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

	if (
		interaction.type === APPLICATION_COMMAND &&
		interaction.data?.name === "keyword"
	) {
		const sub = interaction.data.options?.[0];
		if (!sub) return reply("サブコマンドがありません。");
		const word = sub.options?.find((o) => o.name === "word")?.value;
		return reply(await executeKeywordCommand(env.STATE, sub.name, word));
	}

	return new Response("unhandled interaction", { status: 400 });
}
