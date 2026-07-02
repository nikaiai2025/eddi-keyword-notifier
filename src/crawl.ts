/**
 * crawl.ts — 定期巡回ジョブ
 *
 * subject.txt を取得し、前回巡回以降に立った新着スレのタイトルに
 * キーワードが含まれていれば Discord Webhook へ「タイトル + URL」を投稿する。
 *
 * 重複投稿防止:
 *   KV の lastSeen（通知判定済みの最大スレ番号）より大きい番号のスレのみ照合する。
 *   各スレは初出時に一度だけ判定されるため、同一スレの再通知は発生しない。
 */

import type { Env } from "./env";
import { getKeywords } from "./keywords";
import {
	buildThreadUrl,
	fetchSubjectTxt,
	type SubjectEntry,
} from "./subject-txt";

const LAST_SEEN_KEY = "lastSeen";

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

async function postWebhook(
	webhookUrl: string,
	title: string,
	threadUrl: string,
): Promise<void> {
	const response = await fetch(webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content: `**${title}**\n${threadUrl}` }),
	});
	if (!response.ok) {
		throw new Error(`webhook post failed (${response.status})`);
	}
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
	const keywords = await getKeywords(env.STATE);
	const newCount = entries.filter(
		(e) => Number(e.threadNumber) > lastSeen,
	).length;
	const hits = selectNewMatches(entries, lastSeen, keywords);

	// 重複投稿防止を投稿到達性より優先する: lastSeen を先に進めるため、
	// Webhook 投稿が失敗したスレは次回巡回で再送されない
	if (max > lastSeen) {
		await env.STATE.put(LAST_SEEN_KEY, String(max));
	}

	let posted = 0;
	for (const hit of hits) {
		try {
			await postWebhook(
				env.DISCORD_WEBHOOK_URL,
				hit.title,
				buildThreadUrl(env.SOURCE_URL, hit.threadNumber),
			);
			posted++;
		} catch (error) {
			console.error(`notify failed: thread=${hit.threadNumber}`, error);
		}
	}

	console.log(
		JSON.stringify({
			event: "crawl",
			newThreads: newCount,
			hits: hits.map((h) => h.title),
			posted,
		}),
	);
}
