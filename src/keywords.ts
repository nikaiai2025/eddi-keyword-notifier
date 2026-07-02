/** keywords.ts — KV 上のキーワードリストの読み書き */

const KEYWORDS_KEY = "keywords";

export async function getKeywords(kv: KVNamespace): Promise<string[]> {
	const raw = await kv.get(KEYWORDS_KEY);
	return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function saveKeywords(
	kv: KVNamespace,
	keywords: string[],
): Promise<void> {
	await kv.put(KEYWORDS_KEY, JSON.stringify(keywords));
}
