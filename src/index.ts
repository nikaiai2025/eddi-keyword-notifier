/**
 * index.ts — Worker エントリポイント
 *
 * scheduled: Cron Trigger（5分毎）で掲示板を巡回し、キーワード一致スレを通知する
 * fetch:     Discord HTTP Interactions（/keyword コマンド）を受け付ける
 */

import { runCrawl } from "./crawl";
import type { Env } from "./env";
import { handleInteraction } from "./interactions";

export default {
	async scheduled(
		_controller: ScheduledController,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		await runCrawl(env);
	},

	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === "POST") {
			return handleInteraction(request, env);
		}
		return new Response("ok");
	},
};
