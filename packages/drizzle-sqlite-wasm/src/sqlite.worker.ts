import sqlite3InitModule, {
	// type BindingSpec,
	type Database,
	type Sqlite3Static,
} from "@sqlite.org/sqlite-wasm";
import { WorkerHelper } from "@firtoz/worker-helper";
import {
	SqliteWorkerClientMessageSchema,
	SqliteWorkerClientMessageType,
	sqliteWorkerServerMessage,
	SqliteWorkerServerMessageType,
	type SqliteWorkerClientMessage,
	type SqliteWorkerServerMessage,
} from "./sqlite-worker-schema";
import { handleRemoteCallback } from "./handle-remote-callback";
import { exhaustiveGuard } from "@firtoz/maybe-error";

// Declare self as DedicatedWorkerGlobalScope for TypeScript
declare var self: DedicatedWorkerGlobalScope;

// export type WorkerMessage =
// 	| {
// 			type: "setup";
// 			dbName: string;
// 	  }
// 	| {
// 			type: "query";
// 			id: string;
// 			sql: string;
// 			params: BindingSpec;
// 			method: "run" | "all" | "values" | "get";
// 	  };

// Define types for diagnostics information
export type StorageDiagnostics = {
	isSecureContext: boolean;
	hasOPFS: boolean;
	opfsAccessible: boolean;
	hasFileSystem: boolean;
	hasStorage: boolean;
	hasStoragePersist: boolean;
	navigatorStorageEstimate: StorageEstimate | null;
	headers: {
		coep: string | null;
		coop: string | null;
	};
};

type StorageTransientStatusReason =
	| "indexeddb-error"
	| "not-secure-context"
	| "not-cross-origin-isolated";

// Define types for worker messages and status
export type WorkerStorageStatus =
	| {
			status: "persistent";
			diagnostics: StorageDiagnostics;
	  }
	| {
			status: "transient";
			reason: StorageTransientStatusReason;
			diagnostics: StorageDiagnostics;
	  };

// export type WorkerResponse =
// 	| {
// 			id: string;
// 			type: "response";
// 			result: { rows: unknown[] | unknown[][] };
// 			error?: string;
// 	  }
// 	| {
// 			type: "log" | "error";
// 			payload: string;
// 	  }
// 	| {
// 			type: "storage-status";
// 			status: WorkerStorageStatus;
// 	  }
// 	| {
// 			type: "request-setup";
// 	  }
// 	| {
// 			type: "ready";
// 	  }
// 	| {
// 			type: "check-cross-origin-resources";
// 	  };

export const log = (...args: unknown[]) => {
	console.log(`[${new Date().toISOString()}]`, ...args);
};

const error = (...args: unknown[]) => {
	console.error(`[${new Date().toISOString()}]`, ...args);
};

let sqliteDb: Database | null = null;

const getDiagnostics = async (): Promise<StorageDiagnostics> => {
	const isSecureContext = self.isSecureContext;
	const hasOPFS = "storage" in navigator && "getDirectory" in navigator.storage;
	const hasFileSystem = "showOpenFilePicker" in self;
	const hasStorage = "storage" in navigator;
	const hasStoragePersist = "persist" in (navigator?.storage ?? {});

	// Test OPFS access directly
	let opfsAccessible = false;
	if (hasOPFS) {
		try {
			opfsAccessible = true;
		} catch (e) {
			log(
				"OPFS direct test failed:",
				e instanceof Error ? e.message : String(e),
			);
		}
	}

	let navigatorStorageEstimate: StorageEstimate | null = null;
	if (hasStorage) {
		try {
			navigatorStorageEstimate = await navigator.storage.estimate();
		} catch (e) {
			console.error("Failed to get storage estimate:", e);
		}
	}

	// Check if cross-origin isolation is enabled
	const isCrossOriginIsolated = self.crossOriginIsolated;

	// Log detailed cross-origin isolation info
	log("Cross-Origin Isolation Status:");
	log("- self.crossOriginIsolated:", isCrossOriginIsolated);

	// Try to fetch the current page to check headers directly
	try {
		const response = await fetch(self.location.href);
		const coepHeader = response.headers.get("cross-origin-embedder-policy");
		const coopHeader = response.headers.get("cross-origin-opener-policy");
		const permissionsPolicyHeader = response.headers.get("permissions-policy");
		const corpHeader = response.headers.get("cross-origin-resource-policy");

		log("- Actual HTTP Headers (from fetch):");
		log("  - Cross-Origin-Embedder-Policy:", coepHeader || "not set");
		log("  - Cross-Origin-Opener-Policy:", coopHeader || "not set");
		log("  - Cross-Origin-Resource-Policy:", corpHeader || "not set");
		log("  - Permissions-Policy:", permissionsPolicyHeader || "not set");

		// Check if permissions policy might be blocking cross-origin-isolation
		if (permissionsPolicyHeader?.includes("cross-origin-isolated=()")) {
			log("  - WARNING: Permissions-Policy is blocking cross-origin-isolation");
		}
	} catch (e) {
		log(
			"- Failed to fetch headers:",
			e instanceof Error ? e.message : String(e),
		);
	}

	const headers = {
		coep: self.crossOriginIsolated ? "require-corp" : null,
		coop: self.crossOriginIsolated ? "same-origin" : null,
	};

	return {
		isSecureContext,
		hasOPFS,
		hasFileSystem,
		hasStorage,
		hasStoragePersist,
		navigatorStorageEstimate,
		headers,
		opfsAccessible,
	};
};

const start = async (sqlite3: Sqlite3Static, dbName: string) => {
	log("Running SQLite3 version", sqlite3.version.libVersion);

	// Get diagnostics information
	const diagnostics = await getDiagnostics();

	// Log diagnostic results
	log("Diagnostics results:");
	log(
		"Security Context:",
		diagnostics.isSecureContext ? "Secure" : "Not Secure",
	);
	log(
		"Storage APIs:",
		[
			diagnostics.hasOPFS ? "OPFS" : null,
			diagnostics.hasFileSystem ? "File System" : null,
			diagnostics.hasStorage ? "Storage" : null,
			diagnostics.hasStoragePersist ? "Persistence" : null,
		]
			.filter(Boolean)
			.join(", ") || "None available",
	);

	// Log OPFS status
	log("OPFS API available:", diagnostics.hasOPFS ? "Yes" : "No");
	log("OPFS directly accessible:", diagnostics.opfsAccessible ? "Yes" : "No");
	log("SQLite OPFS support:", "opfs" in sqlite3 ? "Yes" : "No");

	if (diagnostics.navigatorStorageEstimate) {
		const { quota, usage } = diagnostics.navigatorStorageEstimate;
		const usedMB = Math.round(usage ? usage / (1024 * 1024) : 0);
		const quotaMB = Math.round(quota ? quota / (1024 * 1024) : 0);
		log(
			"Storage Usage:",
			`${usedMB}MB of ${quotaMB}MB (${quota ? Math.round(((usage || 0) / quota) * 100) : 0}%)`,
		);
	}

	log("Security Headers:");
	log("- Cross-Origin-Embedder-Policy:", diagnostics.headers.coep || "not set");
	log("- Cross-Origin-Opener-Policy:", diagnostics.headers.coop || "not set");
	log("Cross-Origin Isolated:", self.crossOriginIsolated ? "Yes" : "No");

	let storageStatus: WorkerStorageStatus;

	const dbFileName = `${dbName}.sqlite3`;

	if ("opfs" in sqlite3) {
		sqliteDb = new sqlite3.oo1.OpfsDb(dbFileName);
		log("OPFS is available, created persisted database at", sqliteDb.filename);
		storageStatus = {
			status: "persistent",
			diagnostics,
		};
	} else {
		sqliteDb = new sqlite3.oo1.DB(dbFileName, "c");
		log("OPFS is not available, created transient database", sqliteDb.filename);

		let reason: StorageTransientStatusReason;

		if (!diagnostics.isSecureContext) {
			reason = "not-secure-context";
			log("OPFS unavailable reason: Not in a secure context (HTTPS required)");
		} else if (!self.crossOriginIsolated) {
			reason = "not-cross-origin-isolated";
			log("OPFS unavailable reason: Site is not cross-origin isolated");
			log(
				"Required headers: Cross-Origin-Embedder-Policy: require-corp and Cross-Origin-Opener-Policy: same-origin",
			);
		} else {
			reason = "indexeddb-error";
			log(
				"OPFS unavailable reason: Unknown (possibly browser support or permissions)",
			);
		}

		storageStatus = {
			status: "transient",
			reason,
			diagnostics,
		};
	}

	// Send storage status to main thread
	log("[SQLite Worker] storage-status", storageStatus);

	try {
		// Database is now ready for use
		log("Database ready for use");

		// Notify that the worker is loaded
		// log({ type: "ready" });

		// const drizzle = drizzleSqliteWasm(sqliteDb);
	} catch (err) {
		if (err instanceof Error) {
			error(err.name, err.message);
		} else {
			error(err);
		}
	}
};

// const _sqliteInstance: Sqlite3Static | null = null;

// const handleMessage = async (event: MessageEvent) => {
// 	const message = event.data as WorkerMessage;

// 	if (message.type === "setup") {
// 		if (!sqliteInstance) {
// 			error("Wait for request-setup!");
// 		} else {
// 			start(sqliteInstance, message.dbName);
// 		}
// 		return;
// 	}

// 	if (message.type !== "query" || !sqliteDb) {
// 		return;
// 	}

// 	try {
// 		const { id, sql, params, method } = message;

// 		// Execute the query using the SQLite database
// 		let result: { rows: unknown[] | unknown[][] } = { rows: [] };

// 		if (method === "run") {
// 			// For INSERT, UPDATE, DELETE operations
// 			sqliteDb.exec({
// 				sql,
// 				bind: params,
// 				callback: () => {},
// 			});
// 			result = { rows: [] };
// 		} else if (method === "get") {
// 			// For getting a single row
// 			const columnNames: string[] = [];
// 			let rowData: unknown[] = [];

// 			// Get column names and data in one go
// 			sqliteDb.exec({
// 				sql,
// 				bind: params,
// 				columnNames: columnNames,
// 				callback: (row) => {
// 					if (Array.isArray(row)) {
// 						rowData = row;
// 					} else if (row) {
// 						rowData = columnNames.map((col) => row[col]);
// 					}
// 				},
// 			});

// 			result = { rows: rowData };
// 		} else if (method === "all" || method === "values") {
// 			// For getting multiple rows
// 			const columnNames: string[] = [];
// 			const rowsData: unknown[][] = [];

// 			sqliteDb.exec({
// 				sql,
// 				bind: params,
// 				columnNames: columnNames,
// 				callback: (row) => {
// 					if (Array.isArray(row)) {
// 						rowsData.push(row);
// 					} else if (row) {
// 						rowsData.push(columnNames.map((col) => row[col]));
// 					}
// 				},
// 			});

// 			result = { rows: rowsData };
// 		}

// 		// Send the response back
// 		const response: WorkerResponse = {
// 			id,
// 			type: "response",
// 			result,
// 		};

// 		log(response);
// 	} catch (e) {
// 		const errorMessage = e instanceof Error ? e.message : String(e);

// 		const response: WorkerResponse = {
// 			id: message.id,
// 			type: "response",
// 			result: { rows: [] },
// 			error: errorMessage,
// 		};

// 		log(response);
// 		error("Error executing query:", errorMessage);
// 	}
// };

// self.addEventListener("message", handleMessage);

log("Loading and initializing SQLite3 module...");

const initPromise = sqlite3InitModule({
	print: log,
	printErr: error,
});

// sqlite3InitModule({
// 	print: log,
// 	printErr: error,
// }).then((sqlite3) => {
// 	_sqliteInstance = sqlite3;

// 	log("Done initializing. Running...");
// 	try {
// 		// sendMessage({
// 		// 	type: "request-setup",
// 		// });
// 		start(sqlite3, "test");
// 	} catch (err) {
// 		if (err instanceof Error) {
// 			error(err.name, err.message);
// 		} else {
// 			error(err);
// 		}
// 	}
// });

// const s = z.string().brand("test").parse("hey");

class SqliteWorkerHelper extends WorkerHelper<
	SqliteWorkerClientMessage,
	SqliteWorkerServerMessage
> {
	constructor() {
		super(self, SqliteWorkerClientMessageSchema, sqliteWorkerServerMessage, {
			handleMessage: (data) => {
				console.log(
					`[${new Date().toISOString()}] [SqliteWorkerHelper] handleMessage`,
					data,
				);
				this._handleMessage(data);
			},
			handleInputValidationError: (error, originalData) => {
				console.error("Input validation error", { error, originalData });
				throw new Error(`Invalid input: ${error.message}`);
			},
			handleOutputValidationError: (error, originalData) => {
				console.error("Output validation error", { error, originalData });
				throw new Error(`Invalid output: ${error.message}`);
			},
			handleProcessingError: (error, validatedData) => {
				console.error("Processing error", { error, validatedData });
				throw new Error(`Processing error: ${String(error)}`);
			},
		});

		console.log(
			`[${new Date().toISOString()}] [SqliteWorkerHelper] sending ready`,
		);

		this.send({
			type: SqliteWorkerServerMessageType.Ready,
		});
	}

	private async _handleMessage(data: SqliteWorkerClientMessage) {
		const { type } = data;
		switch (type) {
			case SqliteWorkerClientMessageType.Start:
				{
					console.log("start", data);
					const sqlite3 = await initPromise;
					await start(sqlite3, data.dbName);

					this.send({
						type: SqliteWorkerServerMessageType.Started,
					});
				}
				break;
			case SqliteWorkerClientMessageType.RemoteCallbackRequest:
				{
					console.log(
						`[${new Date().toISOString()}] [SqliteWorkerHelper] remote callback request`,
						data,
					);
					if (!sqliteDb) {
						console.error(
							`[${new Date().toISOString()}] [SqliteWorkerHelper] SQLite database not initialized`,
						);
						this.send({
							type: SqliteWorkerServerMessageType.RemoteCallbackError,
							id: data.id,
							error: "SQLite database not initialized",
						});
						return;
					}

					console.log(
						`[${new Date().toISOString()}] [SqliteWorkerHelper] remote-callback`,
						data,
					);
					const result = await handleRemoteCallback({
						sqliteDb,
						sql: data.sql,
						params: data.params,
						method: data.method,
					});

					if (result.success) {
						console.log(
							`[${new Date().toISOString()}] [SqliteWorkerHelper] remote callback response`,
							result.result.rows,
						);
						this.send({
							type: SqliteWorkerServerMessageType.RemoteCallbackResponse,
							id: data.id,
							rows: result.result.rows,
						});
					} else {
						console.error("Error handling remote callback", result.error);
						this.send({
							type: SqliteWorkerServerMessageType.RemoteCallbackError,
							id: data.id,
							error: result.error,
						});
					}
				}
				break;
			default:
				return exhaustiveGuard(type);
		}
	}
}

new SqliteWorkerHelper();
