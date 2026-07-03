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

/** 掲示板がエスケープに使う名前付き文字参照（最小集合） */
const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

/**
 * HTML 文字参照をデコードする。
 * エッヂは Shift_JIS に無い文字（絵文字等）を数値文字参照（&#N;）で格納する。
 * 異体字セレクタ（U+FE0F）や ZWJ（U+200D）も個別の参照になるため、
 * すべて復元すると結合絵文字もそのまま表示できる。
 */
export function decodeHtmlEntities(text: string): string {
	return text.replace(
		/&(#(?:\d+|[xX][0-9a-fA-F]+)|amp|lt|gt|quot|apos);/g,
		(match, body: string) => {
			if (!body.startsWith("#")) return NAMED_ENTITIES[body];
			const code =
				body[1] === "x" || body[1] === "X"
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			try {
				return String.fromCodePoint(code);
			} catch {
				return match; // 不正なコードポイントはそのまま残す
			}
		},
	);
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
				title: decodeHtmlEntities(match[2].trim()),
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
