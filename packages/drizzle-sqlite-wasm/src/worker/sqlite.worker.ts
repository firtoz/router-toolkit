import type {
	// type BindingSpec,
	Database,
	Sqlite3Static,
} from "@sqlite.org/sqlite-wasm";

import { WorkerHelper } from "@firtoz/worker-helper";
import {
	SqliteWorkerClientMessageSchema,
	SqliteWorkerClientMessageType,
	sqliteWorkerServerMessage,
	SqliteWorkerServerMessageType,
	type SqliteWorkerClientMessage,
	type SqliteWorkerServerMessage,
	type StartRequestId,
	DbIdSchema,
} from "./schema";
import { handleRemoteCallback } from "../drizzle/handle-callback";
import { exhaustiveGuard } from "@firtoz/maybe-error";

// Declare self as DedicatedWorkerGlobalScope for TypeScript
declare var self: DedicatedWorkerGlobalScope;

// Define types for diagnostics information
export type StorageDiagnostics = {
	isSecureContext: boolean;
	hasOPFS: boolean;
	opfsAccessible: boolean;
	hasFileSystem: boolean;
	hasStorage: boolean;
	hasStoragePersist: boolean;
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
	private databases = new Map<
		import("./schema").DbId,
		{ db: Database; initialized: boolean }
	>();
	private diagnostics: StorageDiagnostics | null = null;
	private isPrepared = false;

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

		this.initPromise = import("@sqlite.org/sqlite-wasm").then(
			async ({ default: sqlite3InitModule }) => {
				const result = await sqlite3InitModule({
					print: this.log.bind(this),
					printErr: this.error.bind(this),
				});

				console.log("[PERF] SQLite3 module loaded");
				return result;
			},
		);

		console.log(
			`[${new Date().toISOString()}] [SqliteWorkerHelper] sending ready`,
		);

		this.send({
			type: SqliteWorkerServerMessageType.Ready,
		});

		console.log("[PERF] SQLite worker constructor complete");
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
			headers,
			opfsAccessible,
		};
	}

	// Helper method to process remote callback requests
	private async processRemoteCallbackRequest(
		data: Extract<
			SqliteWorkerClientMessage,
			{ type: SqliteWorkerClientMessageType.RemoteCallbackRequest }
		>,
		sqliteDb: Database,
	): Promise<void> {
		console.log(
			`[${new Date().toISOString()}] [SqliteWorkerHelper] remote-callback for dbId: ${data.dbId}`,
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

	private async prepare(sqlite3: Sqlite3Static) {
		if (this.isPrepared) {
			this.log("Already prepared, skipping diagnostics");
			return;
		}

		this.log("Preparing worker - running diagnostics");
		this.diagnostics = await this.getDiagnostics();
		this.isPrepared = true;

		console.log("[PERF] Worker diagnostics complete");

		// Log diagnostic results
		this.log("Diagnostics results:");
		this.log(
			"Security Context:",
			this.diagnostics.isSecureContext ? "Secure" : "Not Secure",
		);
		this.log(
			"Storage APIs:",
			[
				this.diagnostics.hasOPFS ? "OPFS" : null,
				this.diagnostics.hasFileSystem ? "File System" : null,
				this.diagnostics.hasStorage ? "Storage" : null,
				this.diagnostics.hasStoragePersist ? "Persistence" : null,
			]
				.filter(Boolean)
				.join(", ") || "None available",
		);
		this.log("OPFS API available:", this.diagnostics.hasOPFS ? "Yes" : "No");
		this.log(
			"OPFS directly accessible:",
			this.diagnostics.opfsAccessible ? "Yes" : "No",
		);
		this.log("SQLite OPFS support:", "opfs" in sqlite3 ? "Yes" : "No");

		this.log("Security Headers:");
		this.log(
			"- Cross-Origin-Embedder-Policy:",
			this.diagnostics.headers.coep || "not set",
		);
		this.log(
			"- Cross-Origin-Opener-Policy:",
			this.diagnostics.headers.coop || "not set",
		);
		this.log("Cross-Origin Isolated:", self.crossOriginIsolated ? "Yes" : "No");
	}

	private async startDatabase(
		sqlite3: Sqlite3Static,
		dbName: string,
		requestId: StartRequestId,
	) {
		if (!this.isPrepared || !this.diagnostics) {
			throw new Error("Worker not prepared - call prepare first");
		}

		const dbId = DbIdSchema.parse(crypto.randomUUID());
		this.log(
			`Starting database "${dbName}" with dbId: ${dbId}, requestId: ${requestId}`,
		);

		const dbFileName = `${dbName}.sqlite3`;
		let db: Database;

		if ("opfs" in sqlite3) {
			db = new sqlite3.oo1.OpfsDb(dbFileName);
			this.log("OPFS is available, created persisted database at", db.filename);
		} else {
			db = new sqlite3.oo1.DB(dbFileName, "c");
			this.log(
				"OPFS is not available, created transient database",
				db.filename,
			);
		}

		// Store database with initialized flag
		this.databases.set(dbId, { db, initialized: true });

		console.log(`[PERF] Worker database initialized for ${dbName}`);
		this.log(`Database ${dbId} ready for use`);

		// Send Started message with dbId and requestId
		this.send({
			type: SqliteWorkerServerMessageType.Started,
			requestId,
			dbId,
		});
	}

	private async _handleMessage(data: SqliteWorkerClientMessage) {
		const { type } = data;
		switch (type) {
			case SqliteWorkerClientMessageType.Prepare:
				{
					console.log("prepare");
					const sqlite3 = await this.initPromise;
					await this.prepare(sqlite3);

					this.send({
						type: SqliteWorkerServerMessageType.Prepared,
					});
				}
				break;
			case SqliteWorkerClientMessageType.Start:
				{
					console.log("start", data);
					const sqlite3 = await this.initPromise;
					await this.startDatabase(sqlite3, data.dbName, data.requestId);
				}
				break;
			case SqliteWorkerClientMessageType.RemoteCallbackRequest:
				{
					console.log(
						`[${new Date().toISOString()}] [SqliteWorkerHelper] remote callback request`,
						data,
					);

					// Get the database for this request
					const dbEntry = this.databases.get(data.dbId);
					if (!dbEntry) {
						this.error(`Database not found for dbId: ${data.dbId}`);
						this.send({
							type: SqliteWorkerServerMessageType.RemoteCallbackError,
							id: data.id,
							error: `Database not found: ${data.dbId}`,
						});
						return;
					}

					if (!dbEntry.initialized) {
						this.error(`Database not initialized for dbId: ${data.dbId}`);
						this.send({
							type: SqliteWorkerServerMessageType.RemoteCallbackError,
							id: data.id,
							error: `Database not initialized: ${data.dbId}`,
						});
						return;
					}

					// Process the request with the correct database
					await this.processRemoteCallbackRequest(data, dbEntry.db);
				}
				break;
			default:
				return exhaustiveGuard(type);
		}
	}
}

new SqliteWorkerHelper();
