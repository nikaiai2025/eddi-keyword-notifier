/**
 * crawl.ts — 定期巡回ジョブ（マルチサーバー対応）
 *
 * subject.txt を取得し、前回巡回以降に立った新着スレのタイトルを
 * 登録サーバーごとのキーワードで照合、一致分を各サーバーの通知先チャンネルへ投稿する。
 *
 * 重複投稿防止:
 *   KV の lastSeen（判定済みの最大スレ番号）より大きい番号のスレのみ照合する。
 *   各スレは初出時に一度だけ判定されるため、同一スレの再通知は発生しない。
 */

import { postChannelMessage } from "./discord-api";
import type { Env } from "./env";
import { deleteGuild, listGuilds } from "./guilds";
import {
	buildThreadUrl,
	fetchSubjectTxt,
	type SubjectEntry,
} from "./subject-txt";

const LAST_SEEN_KEY = "lastSeen";
/** Discord メッセージ本文の上限文字数 */
const MESSAGE_LIMIT = 2000;
/** 「…ほか N 件」行のための余白 */
const OVERFLOW_RESERVE = 20;

/** lastSeen より新しく、いずれかのキーワードをタイトルに含むスレをスレ番号昇順で返す。 */
export function selectNewMatches(
	entries: SubjectEntry[],
	lastSeen: number,
	keywords: string[],
): SubjectEntry[] {
	const lowered = keywords.map((k) => k.toLowerCase());
	return entries
		.filter((e) => Number(e.threadNumber) > lastSeen)
		.filter((e) => {
			const title = e.title.toLowerCase();
			return lowered.some((k) => title.includes(k));
		})
		.sort((a, b) => Number(a.threadNumber) - Number(b.threadNumber));
}

export function maxThreadNumber(entries: SubjectEntry[]): number {
	return Math.max(...entries.map((e) => Number(e.threadNumber)));
}

/**
 * ヒット一覧を1通のメッセージ本文に整形する。
 * 通知は1巡回・1サーバーにつき最大1メッセージ（Discord API 呼び出し削減のため）。
 * 2000文字に収まる分まで掲載し、あふれた分は「…ほか N 件」に丸める。
 */
export function buildNotification(
	hits: SubjectEntry[],
	sourceUrl: string,
): string {
	const blocks = hits.map(
		(h) => `**${h.title}**\n${buildThreadUrl(sourceUrl, h.threadNumber)}`,
	);
	const included: string[] = [];
	let length = 0;
	for (const block of blocks) {
		const addition = block.length + (included.length > 0 ? 2 : 0); // 区切りの空行分
		if (length + addition > MESSAGE_LIMIT - OVERFLOW_RESERVE) break;
		included.push(block);
		length += addition;
	}
	const rest = blocks.length - included.length;
	if (rest > 0) {
		included.push(`…ほか ${rest} 件`);
	}
	return included.join("\n\n");
}

interface GuildCrawlResult {
	guildId: string;
	hits: string[];
	posted: number;
	removed?: boolean;
}

export async function runCrawl(env: Env): Promise<void> {
	const entries = await fetchSubjectTxt(env.SOURCE_URL);
	if (entries.length === 0) return;

	const max = maxThreadNumber(entries);
	const lastSeenRaw = await env.STATE.get(LAST_SEEN_KEY);

	// 初回実行: 現時点を基準点として記録するのみ（既存スレは遡って通知しない）
	if (lastSeenRaw === null) {
		await env.STATE.put(LAST_SEEN_KEY, String(max));
		console.log(JSON.stringify({ event: "crawl:init", baseline: max }));
		return;
	}

	const lastSeen = Number(lastSeenRaw);
	const newCount = entries.filter(
		(e) => Number(e.threadNumber) > lastSeen,
	).length;

	// 重複投稿防止を投稿到達性より優先する: lastSeen を先に進めるため、
	// 投稿が失敗したスレは次回巡回で再送されない
	if (max > lastSeen) {
		await env.STATE.put(LAST_SEEN_KEY, String(max));
	}

	const guilds = await listGuilds(env.STATE);
	const summary: GuildCrawlResult[] = [];

	for (const { guildId, config } of guilds) {
		const hits = selectNewMatches(entries, lastSeen, config.keywords);
		let posted = 0;
		let removed = false;

		if (hits.length > 0) {
			try {
				const result = await postChannelMessage(
					env.DISCORD_BOT_TOKEN,
					config.channelId,
					buildNotification(hits, env.SOURCE_URL),
				);
				if (result === "gone") {
					// 通知先に到達できない（チャンネル削除・Bot退会等）: 登録を解除する
					await deleteGuild(env.STATE, guildId);
					removed = true;
				} else {
					posted = hits.length;
				}
			} catch (error) {
				console.error(`notify failed: guild=${guildId}`, error);
			}
		}

		summary.push({
			guildId,
			hits: hits.map((h) => h.title),
			posted,
			...(removed && { removed }),
		});
	}

	console.log(
		JSON.stringify({ event: "crawl", newThreads: newCount, guilds: summary }),
	);
}
