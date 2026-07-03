/** subject-txt.test.ts — subject.txt パース・文字参照デコード・スレッド URL 構築のテスト */

import { describe, expect, it } from "vitest";
import {
	buildThreadUrl,
	decodeHtmlEntities,
	parseSubjectTxt,
} from "../subject-txt";

describe("parseSubjectTxt", () => {
	it("正常な1行をパースする", () => {
		const result = parseSubjectTxt("1783004100.dat<>【速報】テスト (836)");
		expect(result).toEqual([
			{ threadNumber: "1783004100", title: "【速報】テスト", resCount: 836 },
		]);
	});

	it("複数行・空行混在をパースし、不正な行はスキップする", () => {
		const text = [
			"1783004100.dat<>スレA (100)",
			"",
			"invalid line",
			"1783004200.dat<>スレB (0)",
		].join("\n");

		const result = parseSubjectTxt(text);
		expect(result).toHaveLength(2);
		expect(result[0].title).toBe("スレA");
		expect(result[1].resCount).toBe(0);
	});

	it("空文字列は空配列を返す", () => {
		expect(parseSubjectTxt("")).toHaveLength(0);
	});
});

describe("decodeHtmlEntities", () => {
	it("10進数値文字参照を絵文字に復元する", () => {
		expect(decodeHtmlEntities("&#128073;300万円取られる")).toBe(
			"👉300万円取られる",
		);
	});

	it("ZWJ・異体字セレクタを含む結合絵文字を復元する", () => {
		// 👨 + ZWJ + 👩 の家族絵文字
		expect(decodeHtmlEntities("&#128104;&#8205;&#128105;")).toBe("👨‍👩");
	});

	it("16進参照と名前付き参照をデコードする", () => {
		expect(decodeHtmlEntities("&#x1F605;A&amp;B&lt;C&gt;")).toBe("😅A&B<C>");
	});

	it("不正なコードポイントはそのまま残す", () => {
		expect(decodeHtmlEntities("&#9999999999;")).toBe("&#9999999999;");
	});

	it("parseSubjectTxt のタイトルにも適用される", () => {
		const result = parseSubjectTxt(
			"1000.dat<>&#128018;「ワシは甘くないで」 (5)",
		);
		expect(result[0].title).toBe("🐒「ワシは甘くないで」");
	});
});

describe("buildThreadUrl", () => {
	it("subject.txt の URL から read.cgi 形式の URL を構築する", () => {
		expect(
			buildThreadUrl(
				"https://bbs.eddibb.cc/liveedge/subject.txt",
				"1783004100",
			),
		).toBe("https://bbs.eddibb.cc/test/read.cgi/liveedge/1783004100/");
	});
});
