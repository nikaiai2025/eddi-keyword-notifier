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
/** 1巡回・1サーバーあたりの投稿上限（頻出キーワード登録による洪水防止） */
const MAX_POSTS_PER_GUILD = 5;
/** 1巡回あたりの総投稿上限（Workers のサブリクエスト上限対策） */
const MAX_POSTS_PER_CRAWL = 20;

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
	let budget = MAX_POSTS_PER_CRAWL;
	const summary: GuildCrawlResult[] = [];

	for (const { guildId, config } of guilds) {
		const hits = selectNewMatches(entries, lastSeen, config.keywords);
		let posted = 0;
		let removed = false;

		for (const hit of hits.slice(0, MAX_POSTS_PER_GUILD)) {
			if (budget <= 0) break;
			try {
				budget--;
				const result = await postChannelMessage(
					env.DISCORD_BOT_TOKEN,
					config.channelId,
					`**${hit.title}**\n${buildThreadUrl(env.SOURCE_URL, hit.threadNumber)}`,
				);
				if (result === "gone") {
					// 通知先に到達できない（チャンネル削除・Bot退会等）: 登録を解除する
					await deleteGuild(env.STATE, guildId);
					removed = true;
					break;
				}
				posted++;
			} catch (error) {
				console.error(
					`notify failed: guild=${guildId} thread=${hit.threadNumber}`,
					error,
				);
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
