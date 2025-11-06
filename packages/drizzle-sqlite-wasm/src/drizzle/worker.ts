import type { DrizzleConfig } from "drizzle-orm";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";
import type { SqliteWorkerClient } from "../worker/client";
import { RemoteCallbackIdSchema } from "../worker/schema";

export const drizzleSqliteWasmWorker = <
	TSchema extends Record<string, unknown> = Record<string, never>,
>(
	client: SqliteWorkerClient,
	config: DrizzleConfig<TSchema> = {},
	debug: boolean = false,
) => {
	return drizzleSqliteProxy<TSchema>(async (sql, params, method) => {
		const id = RemoteCallbackIdSchema.parse(crypto.randomUUID());

		return new Promise<{ rows: unknown[] }>((resolve, reject) => {
			if (debug) {
				console.log(
					"[drizzleSqliteWasmWorker] performing remote callback",
					id,
					sql,
					params,
					method,
				);
			}

			client.performRemoteCallback(
				{
					sql,
					params,
					method,
				},
				resolve,
				reject,
			);
		});
	}, config);
};
