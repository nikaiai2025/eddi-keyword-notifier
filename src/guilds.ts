/** guilds.ts — KV 上のサーバー別設定（guild:{サーバーID}）の読み書き */

export interface GuildConfig {
	/** 巡回キーワード */
	keywords: string[];
	/** 通知先チャンネル ID */
	channelId: string;
}

const PREFIX = "guild:";

export async function getGuild(
	kv: KVNamespace,
	guildId: string,
): Promise<GuildConfig | null> {
	const raw = await kv.get(PREFIX + guildId);
	return raw ? (JSON.parse(raw) as GuildConfig) : null;
}

export async function putGuild(
	kv: KVNamespace,
	guildId: string,
	config: GuildConfig,
): Promise<void> {
	await kv.put(PREFIX + guildId, JSON.stringify(config));
}

export async function deleteGuild(
	kv: KVNamespace,
	guildId: string,
): Promise<void> {
	await kv.delete(PREFIX + guildId);
}

export async function countGuilds(kv: KVNamespace): Promise<number> {
	const list = await kv.list({ prefix: PREFIX });
	return list.keys.length;
}

export async function listGuilds(
	kv: KVNamespace,
): Promise<Array<{ guildId: string; config: GuildConfig }>> {
	const list = await kv.list({ prefix: PREFIX });
	const results = await Promise.all(
		list.keys.map(async (key) => {
			const raw = await kv.get(key.name);
			return raw
				? {
						guildId: key.name.slice(PREFIX.length),
						config: JSON.parse(raw) as GuildConfig,
					}
				: null;
		}),
	);
	return results.filter(
		(r): r is { guildId: string; config: GuildConfig } => r !== null,
	);
}
