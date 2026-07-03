/** crawl.test.ts — 新着スレ抽出（キーワード照合・重複防止）と通知整形のテスト */

import { describe, expect, it } from "vitest";
import { buildNotification, selectNewMatches } from "../crawl";
import type { SubjectEntry } from "../subject-txt";

function entry(threadNumber: string, title: string): SubjectEntry {
	return { threadNumber, title, resCount: 1 };
}

describe("selectNewMatches", () => {
	const entries = [
		entry("1000", "野球実況スレ"),
		entry("2000", "サッカー代表戦"),
		entry("3000", "野球ドラフト会議"),
	];

	it("lastSeen 以前のスレは対象外（重複投稿防止）", () => {
		const result = selectNewMatches(entries, 2000, ["野球"]);
		expect(result.map((e) => e.threadNumber)).toEqual(["3000"]);
	});

	it("キーワードに一致しないスレは通知しない", () => {
		const result = selectNewMatches(entries, 0, ["将棋"]);
		expect(result).toHaveLength(0);
	});

	it("複数キーワードのいずれかに一致すれば通知する", () => {
		const result = selectNewMatches(entries, 0, ["将棋", "サッカー"]);
		expect(result.map((e) => e.title)).toEqual(["サッカー代表戦"]);
	});

	it("キーワード未登録なら何も通知しない", () => {
		expect(selectNewMatches(entries, 0, [])).toHaveLength(0);
	});

	it("英字は大文字小文字を区別せず照合する", () => {
		const result = selectNewMatches([entry("1000", "MLB速報")], 0, ["mlb"]);
		expect(result).toHaveLength(1);
	});

	it("結果はスレ番号昇順（スレ立て順）で返す", () => {
		const unordered = [
			entry("3000", "野球C"),
			entry("1000", "野球A"),
			entry("2000", "野球B"),
		];
		const result = selectNewMatches(unordered, 0, ["野球"]);
		expect(result.map((e) => e.threadNumber)).toEqual(["1000", "2000", "3000"]);
	});
});

describe("buildNotification", () => {
	const sourceUrl = "https://bbs.eddibb.cc/liveedge/subject.txt";

	it("1件のヒットをタイトルとURLで整形する", () => {
		const msg = buildNotification([entry("1000", "野球スレ")], sourceUrl);
		expect(msg).toBe(
			"**野球スレ**\nhttps://bbs.eddibb.cc/test/read.cgi/liveedge/1000/",
		);
	});

	it("複数ヒットは空行区切りで1メッセージにまとめる", () => {
		const msg = buildNotification(
			[entry("1000", "スレA"), entry("2000", "スレB")],
			sourceUrl,
		);
		expect(msg.split("\n\n")).toHaveLength(2);
		expect(msg).toContain("**スレA**");
		expect(msg).toContain("**スレB**");
	});

	it("2000文字に収まる限り件数制限なく掲載する", () => {
		const hits = Array.from({ length: 10 }, (_, i) =>
			entry(String(1000 + i), `スレ${i}`),
		);
		const msg = buildNotification(hits, sourceUrl);
		expect(msg.split("\n\n")).toHaveLength(10);
		expect(msg).not.toContain("…ほか");
	});

	it("2000文字を超える分は「…ほかN件」に丸める", () => {
		const longTitle = "あ".repeat(100);
		const hits = Array.from({ length: 30 }, (_, i) =>
			entry(String(1000 + i), `${longTitle}${i}`),
		);
		const msg = buildNotification(hits, sourceUrl);
		expect(msg.length).toBeLessThanOrEqual(2000);
		expect(msg).toMatch(/…ほか \d+ 件$/);
	});
});
