/** crawl.test.ts — 新着スレ抽出（キーワード照合・重複防止）のテスト */

import { describe, expect, it } from "vitest";
import { selectNewMatches } from "../crawl";
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
