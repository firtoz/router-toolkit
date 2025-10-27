import type { Database } from "@sqlite.org/sqlite-wasm";
import type { DrizzleConfig } from "drizzle-orm";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";

export const drizzleSqliteWasm = <
	TSchema extends Record<string, unknown> = Record<string, never>,
>(
	sqliteDb: Database,
	config: DrizzleConfig<TSchema> = {},
	debug: boolean = false,
) => {
	return drizzleSqliteProxy<TSchema>(async (sql, params, method) => {
		if (debug) {
			console.log("Executing SQL:", sql);
			console.log("Parameters:", params);
			console.log("Method:", method);
		}

		// (parameter) method: "run" | "all" | "values" | "get"
		try {
			if (method === "run") {
				// For INSERT, UPDATE, DELETE operations
				sqliteDb.exec({
					sql,
					bind: params,
					callback: () => {},
				});
				return { rows: [] };
			}

			if (method === "get") {
				// For getting a single row
				const columnNames: string[] = [];
				let rowData: unknown[] = [];
				let callbackReceived = false;

				try {
					// Get column names and data in one go
					sqliteDb.exec({
						sql,
						bind: params,
						columnNames,
						callback: (row) => {
							callbackReceived = true;
							if (debug) {
								console.log("callback Row data:", row);
							}
							if (Array.isArray(row)) {
								// Store the first row's values
								rowData = row;
							} else {
								// Convert object to array if needed
								rowData = columnNames.map((col) => row[col]);
							}
						},
					});
				} catch (e) {
					console.error("Error getting row data:", e);
				}

				if (!callbackReceived) {
					console.error("No callback received for get method");
					return { rows: undefined as unknown as unknown[] };
				}

				if (debug) {
					console.log("columnNames", columnNames);
					console.log("get row data:", rowData);
				}

				// For get method, return a single array of values
				return { rows: rowData };
			}

			if (method === "all" || method === "values") {
				// For getting multiple rows
				const columnNames: string[] = [];
				const rowsData: unknown[][] = [];

				// Get column names and data in one go
				sqliteDb.exec({
					sql,
					bind: params,
					columnNames,
					callback: (row) => {
						if (Array.isArray(row)) {
							// Convert all values to strings
							rowsData.push(row);
						} else {
							// Convert object to array if needed
							rowsData.push(columnNames.map((col) => row[col]));
						}
					},
				});

				if (debug) {
					console.log("columnNames", columnNames);
					console.log("all/values rows data:", rowsData);
				}

				// For all/values methods, return an array of arrays
				return { rows: rowsData };
			}

			return { rows: [] };
		} catch (e: unknown) {
			if (e instanceof Error) {
				console.error("Error executing SQLite query: ", e.message);
			} else {
				console.error("Error executing SQLite query: ", e);
			}
			return { rows: [] };
		}
	}, config);
};
