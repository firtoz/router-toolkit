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

class SqliteWorkerHelper extends WorkerHelper<
	SqliteWorkerClientMessage,
	SqliteWorkerServerMessage
> {
	private initPromise: Promise<Sqlite3Static>;
	sqliteDb: Database | null = null;
	isInitialized = false;
	requestQueue: Array<{
		data: Extract<
			SqliteWorkerClientMessage,
			{ type: SqliteWorkerClientMessageType.RemoteCallbackRequest }
		>;
	}> = [];

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

		this.log("Loading and initializing SQLite3 module...");

		this.initPromise = sqlite3InitModule({
			print: this.log.bind(this),
			printErr: this.error.bind(this),
		});

		console.log(
			`[${new Date().toISOString()}] [SqliteWorkerHelper] sending ready`,
		);

		this.send({
			type: SqliteWorkerServerMessageType.Ready,
		});
	}

	private log(...args: unknown[]) {
		console.log(`[${new Date().toISOString()}]`, ...args);
	}

	private error(...args: unknown[]) {
		console.error(`[${new Date().toISOString()}]`, ...args);
	}

	private async getDiagnostics(): Promise<StorageDiagnostics> {
		const isSecureContext = self.isSecureContext;
		const hasOPFS =
			"storage" in navigator && "getDirectory" in navigator.storage;
		const hasFileSystem = "showOpenFilePicker" in self;
		const hasStorage = "storage" in navigator;
		const hasStoragePersist = "persist" in (navigator?.storage ?? {});

		// Test OPFS access directly
		let opfsAccessible = false;
		if (hasOPFS) {
			try {
				opfsAccessible = true;
			} catch (e) {
				this.log(
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
		this.log("Cross-Origin Isolation Status:");
		this.log("- self.crossOriginIsolated:", isCrossOriginIsolated);

		// Try to fetch the current page to check headers directly
		try {
			const response = await fetch(self.location.href);
			const coepHeader = response.headers.get("cross-origin-embedder-policy");
			const coopHeader = response.headers.get("cross-origin-opener-policy");
			const permissionsPolicyHeader =
				response.headers.get("permissions-policy");
			const corpHeader = response.headers.get("cross-origin-resource-policy");

			this.log("- Actual HTTP Headers (from fetch):");
			this.log("  - Cross-Origin-Embedder-Policy:", coepHeader || "not set");
			this.log("  - Cross-Origin-Opener-Policy:", coopHeader || "not set");
			this.log("  - Cross-Origin-Resource-Policy:", corpHeader || "not set");
			this.log("  - Permissions-Policy:", permissionsPolicyHeader || "not set");

			// Check if permissions policy might be blocking cross-origin-isolation
			if (permissionsPolicyHeader?.includes("cross-origin-isolated=()")) {
				this.log(
					"  - WARNING: Permissions-Policy is blocking cross-origin-isolation",
				);
			}
		} catch (e) {
			this.log(
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
	}

	private async start(sqlite3: Sqlite3Static, dbName: string) {
		this.log("Running SQLite3 version", sqlite3.version.libVersion);

		// Get diagnostics information
		const diagnostics = await this.getDiagnostics();

		// Log diagnostic results
		this.log("Diagnostics results:");
		this.log(
			"Security Context:",
			diagnostics.isSecureContext ? "Secure" : "Not Secure",
		);
		this.log(
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
		this.log("OPFS API available:", diagnostics.hasOPFS ? "Yes" : "No");
		this.log(
			"OPFS directly accessible:",
			diagnostics.opfsAccessible ? "Yes" : "No",
		);
		this.log("SQLite OPFS support:", "opfs" in sqlite3 ? "Yes" : "No");

		if (diagnostics.navigatorStorageEstimate) {
			const { quota, usage } = diagnostics.navigatorStorageEstimate;
			const usedMB = Math.round(usage ? usage / (1024 * 1024) : 0);
			const quotaMB = Math.round(quota ? quota / (1024 * 1024) : 0);
			this.log(
				"Storage Usage:",
				`${usedMB}MB of ${quotaMB}MB (${quota ? Math.round(((usage || 0) / quota) * 100) : 0}%)`,
			);
		}

		this.log("Security Headers:");
		this.log(
			"- Cross-Origin-Embedder-Policy:",
			diagnostics.headers.coep || "not set",
		);
		this.log(
			"- Cross-Origin-Opener-Policy:",
			diagnostics.headers.coop || "not set",
		);
		this.log("Cross-Origin Isolated:", self.crossOriginIsolated ? "Yes" : "No");

		let storageStatus: WorkerStorageStatus;

		const dbFileName = `${dbName}.sqlite3`;

		if ("opfs" in sqlite3) {
			this.sqliteDb = new sqlite3.oo1.OpfsDb(dbFileName);
			this.log(
				"OPFS is available, created persisted database at",
				this.sqliteDb.filename,
			);
			storageStatus = {
				status: "persistent",
				diagnostics,
			};
		} else {
			this.sqliteDb = new sqlite3.oo1.DB(dbFileName, "c");
			this.log(
				"OPFS is not available, created transient database",
				this.sqliteDb.filename,
			);

			let reason: StorageTransientStatusReason;

			if (!diagnostics.isSecureContext) {
				reason = "not-secure-context";
				this.log(
					"OPFS unavailable reason: Not in a secure context (HTTPS required)",
				);
			} else if (!self.crossOriginIsolated) {
				reason = "not-cross-origin-isolated";
				this.log("OPFS unavailable reason: Site is not cross-origin isolated");
				this.log(
					"Required headers: Cross-Origin-Embedder-Policy: require-corp and Cross-Origin-Opener-Policy: same-origin",
				);
			} else {
				reason = "indexeddb-error";
				this.log(
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
		this.log("[SQLite Worker] storage-status", storageStatus);

		try {
			// Database is now ready for use
			this.log("Database ready for use");

			// Mark as initialized
			this.isInitialized = true;

			// Process queued requests
			this.log(`Processing ${this.requestQueue.length} queued requests`);
			await this.processQueuedRequests();
		} catch (err) {
			if (err instanceof Error) {
				this.error(err.name, err.message);
			} else {
				this.error(err);
			}
		}
	}

	// Helper method to process remote callback requests
	private async processRemoteCallbackRequest(
		data: Extract<
			SqliteWorkerClientMessage,
			{ type: SqliteWorkerClientMessageType.RemoteCallbackRequest }
		>,
	): Promise<void> {
		if (!this.sqliteDb) {
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
			sqliteDb: this.sqliteDb,
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

	// Process all queued requests after initialization
	async processQueuedRequests(): Promise<void> {
		while (this.requestQueue.length > 0) {
			const queuedRequest = this.requestQueue.shift();
			if (queuedRequest) {
				try {
					await this.processRemoteCallbackRequest(queuedRequest.data);
				} catch (err) {
					console.error("Error processing queued request:", err);
				}
			}
		}
	}

	private async _handleMessage(data: SqliteWorkerClientMessage) {
		const { type } = data;
		switch (type) {
			case SqliteWorkerClientMessageType.Start:
				{
					console.log("start", data);
					const sqlite3 = await this.initPromise;
					await this.start(sqlite3, data.dbName);

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

					// If database is not initialized, queue the request
					if (!this.isInitialized) {
						console.log(
							`[${new Date().toISOString()}] [SqliteWorkerHelper] Database not initialized, queuing request`,
						);
						this.requestQueue.push({ data });
						return;
					}

					// Process the request immediately if initialized
					await this.processRemoteCallbackRequest(data);
				}
				break;
			default:
				return exhaustiveGuard(type);
		}
	}
}

new SqliteWorkerHelper();
