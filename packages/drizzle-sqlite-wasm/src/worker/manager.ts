import { exhaustiveGuard } from "@firtoz/maybe-error";
import { WorkerClient } from "@firtoz/worker-helper/WorkerClient";
import {
	type SqliteWorkerClientMessage,
	type SqliteWorkerServerMessage,
	type RemoteCallbackId,
	type DbId,
	type StartRequestId,
	SqliteWorkerClientMessageSchema,
	sqliteWorkerServerMessage,
	SqliteWorkerServerMessageType,
	SqliteWorkerClientMessageType,
	type SqliteWorkerRemoteCallbackClientMessage,
	RemoteCallbackIdSchema,
	StartRequestIdSchema,
} from "./schema";

export interface ISqliteWorkerClient {
	performRemoteCallback: (
		data: Omit<SqliteWorkerRemoteCallbackClientMessage, "type" | "id" | "dbId">,
		resolve: (value: { rows: unknown[] }) => void,
		reject: (error: Error) => void,
	) => void;
	onStarted: (callback: () => void) => void;
	terminate: () => void;
}

/**
 * Per-database instance that can perform operations on a specific database
 */
export class DbInstance implements ISqliteWorkerClient {
	private dbId: DbId | null = null;
	private startedCallbacks: Array<() => void> = [];
	private isStarted = false;

	constructor(
		private readonly manager: SqliteWorkerManager,
		public readonly dbName: string,
		private readonly debug: boolean = false,
	) {}

	/**
	 * Internal method called by manager when database is started
	 */
	_setStarted(dbId: DbId) {
		this.dbId = dbId;
		this.isStarted = true;
		performance.mark(`${this.dbName}-db-started`);
		performance.measure(
			`${this.dbName}-db-start`,
			`${this.dbName}-db-start-request`,
			`${this.dbName}-db-started`,
		);
		console.log(`[PERF] Database started for ${this.dbName}`);

		// Call all pending callbacks
		for (const callback of this.startedCallbacks) {
			callback();
		}
		this.startedCallbacks = [];
	}

	public performRemoteCallback(
		data: Omit<SqliteWorkerRemoteCallbackClientMessage, "type" | "id" | "dbId">,
		resolve: (value: { rows: unknown[] }) => void,
		reject: (error: Error) => void,
	) {
		if (!this.dbId) {
			reject(
				new Error(`Database not started - dbId is null for ${this.dbName}`),
			);
			return;
		}

		if (this.debug) {
			console.log(
				`[${new Date().toISOString()}] [DbInstance:${this.dbName}] performing remote callback`,
				data,
			);
		}

		this.manager.performRemoteCallback(this.dbId, data, resolve, reject);
	}

	public onStarted(callback: () => void) {
		if (this.isStarted) {
			// Already started, call immediately
			callback();
		} else {
			this.startedCallbacks.push(callback);
		}
	}

	public terminate() {
		// Per-db instances don't terminate the worker
		// That's managed by the SqliteWorkerManager
	}
}

/**
 * Main worker manager that can create multiple database instances
 */
export class SqliteWorkerManager extends WorkerClient<
	SqliteWorkerClientMessage,
	SqliteWorkerServerMessage
> {
	private readonly remoteCallbacks = new Map<
		RemoteCallbackId,
		{
			resolve: (value: { rows: unknown[] }) => void;
			reject: (error: Error) => void;
		}
	>();

	private readyResolve?: () => void;
	private readyReject?: (error: Error) => void;
	private readonly readyPromise: Promise<void>;
	private isReady = false;

	private preparedResolve?: () => void;
	private preparedReject?: (error: Error) => void;
	private readonly preparedPromise: Promise<void>;
	private isPrepared = false;

	private readonly dbInstances = new Map<string, DbInstance>();
	private readonly pendingStarts = new Map<
		StartRequestId,
		{ dbName: string; instance: DbInstance }
	>();

	constructor(
		worker: Worker,
		private readonly debug: boolean = false,
	) {
		super({
			worker,
			clientSchema: SqliteWorkerClientMessageSchema,
			serverSchema: sqliteWorkerServerMessage,
			onMessage: (message) => {
				this.onMessage(message);
			},
			onValidationError: (error, rawMessage) => {
				console.error(error, rawMessage);
				// Reject promises if we get validation errors before being ready/prepared
				if (!this.isReady && this.readyReject) {
					this.readyReject(new Error(`Validation error: ${error.message}`));
				}
				if (!this.isPrepared && this.preparedReject) {
					this.preparedReject(new Error(`Validation error: ${error.message}`));
				}
			},
			onError: (event) => {
				console.error(event);
				// Reject promises if worker errors before being ready/prepared
				if (!this.isReady && this.readyReject) {
					this.readyReject(
						new Error(`Worker error: ${event.message || "Unknown error"}`),
					);
				}
				if (!this.isPrepared && this.preparedReject) {
					this.preparedReject(
						new Error(`Worker error: ${event.message || "Unknown error"}`),
					);
				}
			},
		});

		this.readyPromise = new Promise((resolve, reject) => {
			this.readyResolve = resolve;
			this.readyReject = reject;
		});

		this.preparedPromise = new Promise((resolve, reject) => {
			this.preparedResolve = resolve;
			this.preparedReject = reject;
		});

		performance.mark("sqlite-wasm-manager-init");
		console.log("[PERF] SQLite Worker Manager initialized");
	}

	/**
	 * Promise that resolves when the worker sends its first Ready message
	 */
	public get ready(): Promise<void> {
		return this.readyPromise;
	}

	/**
	 * Promise that resolves when the worker is prepared (diagnostics complete)
	 */
	public get prepared(): Promise<void> {
		return this.preparedPromise;
	}

	private onMessage(message: SqliteWorkerServerMessage) {
		const { type } = message;
		switch (type) {
			case SqliteWorkerServerMessageType.Ready:
				{
					performance.mark("sqlite-wasm-worker-ready");
					console.log("[PERF] Worker ready");
					this.isReady = true;
					this.readyResolve?.();
					if (this.debug) {
						console.log("[SqliteWorkerManager] ready - sending prepare");
					}
					performance.mark("sqlite-wasm-prepare-request");
					// First, request preparation (diagnostics)
					this.send({
						type: SqliteWorkerClientMessageType.Prepare,
					});
				}
				break;
			case SqliteWorkerServerMessageType.Prepared:
				{
					performance.mark("sqlite-wasm-worker-prepared");
					performance.measure(
						"sqlite-wasm-prepare",
						"sqlite-wasm-prepare-request",
						"sqlite-wasm-worker-prepared",
					);
					console.log("[PERF] Worker prepared");
					this.isPrepared = true;
					this.preparedResolve?.();
					if (this.debug) {
						console.log(
							"[SqliteWorkerManager] prepared and ready for databases",
						);
					}
				}
				break;
			case SqliteWorkerServerMessageType.Started:
				{
					const pending = this.pendingStarts.get(message.requestId);
					if (pending) {
						pending.instance._setStarted(message.dbId);
						this.pendingStarts.delete(message.requestId);
					}
				}
				break;
			case SqliteWorkerServerMessageType.RemoteCallbackResponse:
				{
					const { id, rows } = message;
					const remoteCallback = this.remoteCallbacks.get(id);
					if (remoteCallback) {
						remoteCallback.resolve({ rows });
						this.remoteCallbacks.delete(id);
					}
				}
				break;
			case SqliteWorkerServerMessageType.RemoteCallbackError:
				{
					const { id, error } = message;
					const remoteCallback = this.remoteCallbacks.get(id);
					if (remoteCallback) {
						remoteCallback.reject(new Error(error));
						this.remoteCallbacks.delete(id);
					}
				}
				break;
			default:
				return exhaustiveGuard(type);
		}
	}

	/**
	 * Get or create a database instance
	 */
	public async getDbInstance(dbName: string): Promise<DbInstance> {
		// Check if instance already exists
		let instance = this.dbInstances.get(dbName);
		if (instance) {
			return instance;
		}

		// Wait for worker to be prepared before starting a database
		if (!this.isPrepared) {
			await this.preparedPromise;
		}

		// Check again after waiting (another call might have created it)
		instance = this.dbInstances.get(dbName);
		if (instance) {
			return instance;
		}

		// Create new instance
		instance = new DbInstance(this, dbName, this.debug);
		this.dbInstances.set(dbName, instance);

		// Start the database
		performance.mark(`${dbName}-db-start-request`);
		const startRequestId = StartRequestIdSchema.parse(crypto.randomUUID());
		this.pendingStarts.set(startRequestId, { dbName, instance });

		this.send({
			type: SqliteWorkerClientMessageType.Start,
			requestId: startRequestId,
			dbName: dbName,
		});

		return instance;
	}

	/**
	 * Internal method for db instances to perform remote callbacks
	 */
	public performRemoteCallback(
		dbId: DbId,
		data: Omit<SqliteWorkerRemoteCallbackClientMessage, "type" | "id" | "dbId">,
		resolve: (value: { rows: unknown[] }) => void,
		reject: (error: Error) => void,
	) {
		if (this.debug) {
			console.log(
				`[${new Date().toISOString()}] [SqliteWorkerManager] performing remote callback for dbId: ${dbId}`,
				data,
			);
		}
		const id = RemoteCallbackIdSchema.parse(crypto.randomUUID());
		this.remoteCallbacks.set(id, { resolve, reject });
		this.send({
			type: SqliteWorkerClientMessageType.RemoteCallbackRequest,
			id,
			dbId,
			sql: data.sql,
			params: data.params,
			method: data.method,
		});
	}
}
