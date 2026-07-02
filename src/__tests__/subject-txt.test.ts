/** subject-txt.test.ts — subject.txt パースとスレッド URL 構築のテスト */

import { describe, expect, it } from "vitest";
import { buildThreadUrl, parseSubjectTxt } from "../subject-txt";

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
