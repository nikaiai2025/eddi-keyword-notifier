/**
 * subject-txt.ts — 5ch 互換掲示板の subject.txt 取得・パース
 *
 * フォーマット: `{threadNumber}.dat<>{title} ({resCount})`
 * threadNumber はスレッド作成時刻の Unix タイムスタンプ（単調増加）。
 */

export interface SubjectEntry {
	/** スレッド番号（Unix タイムスタンプ文字列）例: "1783004100" */
	threadNumber: string;
	/** スレタイ */
	title: string;
	/** レス数 */
	resCount: number;
}

/** subject.txt のテキストを解析する。不正な行は無視する。 */
export function parseSubjectTxt(text: string): SubjectEntry[] {
	return text
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => {
			const match = line.match(/^(\d+)\.dat<>(.+)\s+\((\d+)\)$/);
			if (!match) return null;
			return {
				threadNumber: match[1],
				title: match[2].trim(),
				resCount: parseInt(match[3], 10),
			};
		})
		.filter((e): e is SubjectEntry => e !== null);
}

/** subject.txt を取得して Shift_JIS デコード・パースする。 */
export async function fetchSubjectTxt(url: string): Promise<SubjectEntry[]> {
	const response = await fetch(url, {
		headers: { "User-Agent": "Monazilla/1.00 (bbs-keyword-notifier)" },
	});
	if (!response.ok) {
		throw new Error(`fetch failed: ${url} (${response.status})`);
	}
	const buffer = await response.arrayBuffer();
	return parseSubjectTxt(new TextDecoder("shift_jis").decode(buffer));
}

/**
 * subject.txt の URL からスレッド URL（read.cgi 形式）を構築する。
 * 例: https://bbs.eddibb.cc/liveedge/subject.txt
 *   → https://bbs.eddibb.cc/test/read.cgi/liveedge/{threadNumber}/
 */
export function buildThreadUrl(
	subjectUrl: string,
	threadNumber: string,
): string {
	const url = new URL(subjectUrl);
	const boardPath = url.pathname
		.replace(/\/subject\.txt$/, "")
		.replace(/^\/+/, "");
	return `${url.origin}/test/read.cgi/${boardPath}/${threadNumber}/`;
}
