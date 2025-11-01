import {
	exhaustiveGuard,
	fail,
	success,
	type MaybeError,
} from "@firtoz/maybe-error";
import type { Database } from "@sqlite.org/sqlite-wasm";

export const handleRemoteCallback = async ({
	sqliteDb,
	sql,
	params,
	method,
	debug = false,
}: {
	sqliteDb: Database;
	sql: string;
	// biome-ignore lint/suspicious/noExplicitAny: This is what drizzle-orm expects.
	params: any[];
	method: "run" | "all" | "values" | "get";
	debug?: boolean;
}): Promise<MaybeError<{ rows: unknown[] }, string>> => {
	if (debug) {
		console.log("Executing SQL:", sql);
		console.log("Parameters:", params);
		console.log("Method:", method);
	}

	switch (method) {
		case "run": {
			// For INSERT, UPDATE, DELETE operations
			try {
				sqliteDb.exec({
					sql,
					bind: params,
					callback: () => {},
				});

				return success({ rows: [] });
			} catch (e: unknown) {
				const errorMsg = e instanceof Error ? e.message : String(e);
				console.error("Error executing run query:", errorMsg);
				return fail(errorMsg);
			}
		}
		case "get": {
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
			} catch (e: unknown) {
				const errorMsg = e instanceof Error ? e.message : String(e);
				console.error("Error getting row data:", errorMsg);
				return fail(errorMsg);
			}

			if (!callbackReceived) {
				const errorMsg = "No callback received for get method";
				console.error(errorMsg);
				return fail(errorMsg);
			}

			if (debug) {
				console.log("columnNames", columnNames);
				console.log("get row data:", rowData);
			}

			// For get method, return a single array of values
			return success({ rows: rowData });
		}

		case "all":
		case "values": {
			// For getting multiple rows
			const columnNames: string[] = [];
			const rowsData: unknown[][] = [];

			try {
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
			} catch (e: unknown) {
				const errorMsg = e instanceof Error ? e.message : String(e);
				console.error("Error getting all/values data:", errorMsg);
				return fail(errorMsg);
			}

			if (debug) {
				console.log("columnNames", columnNames);
				console.log("all/values rows data:", rowsData);
			}

			// For all/values methods, return an array of arrays
			return success({ rows: rowsData });
		}
	}

	return exhaustiveGuard(method);
};
