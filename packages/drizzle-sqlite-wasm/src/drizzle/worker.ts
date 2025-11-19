import type { DrizzleConfig } from "drizzle-orm";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";
import type { ISqliteWorkerClient } from "../worker/client";

export const drizzleSqliteWasmWorker = <
	TSchema extends Record<string, unknown> = Record<string, never>,
>(
	client: ISqliteWorkerClient,
	config: DrizzleConfig<TSchema> = {},
) => {
	return drizzleSqliteProxy<TSchema>(async (sql, params, method) => {
		return new Promise<{ rows: unknown[] }>((resolve, reject) => {
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
