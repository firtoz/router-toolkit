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

export class SqliteWorkerClient
	extends WorkerClient<SqliteWorkerClientMessage, SqliteWorkerServerMessage>
	implements ISqliteWorkerClient
{
	private readonly remoteCallbacks = new Map<
		RemoteCallbackId,
		{
			resolve: (value: { rows: unknown[] }) => void;
			reject: (error: Error) => void;
		}
	>();

	private dbId: DbId | null = null;
	private startRequestId: StartRequestId | null = null;
	private onStartedCallback?: () => void;

	constructor(
		worker: Worker,
		private readonly dbName: string,
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
			},
			onError: (event) => {
				console.error(event);
			},
		});
	}

	private onMessage(message: SqliteWorkerServerMessage) {
		const { type } = message;
		switch (type) {
			case SqliteWorkerServerMessageType.Ready:
				{
					if (this.debug) {
						console.log("[SqliteWorkerClient] ready - starting database");
					}

					// Now start this specific database
					this.startRequestId = StartRequestIdSchema.parse(crypto.randomUUID());
					this.send({
						type: SqliteWorkerClientMessageType.Start,
						requestId: this.startRequestId,
						dbName: this.dbName,
					});
				}
				break;
			case SqliteWorkerServerMessageType.Started:
				{
					// Check if this is our start request
					if (message.requestId === this.startRequestId) {
						this.dbId = message.dbId;

						if (this.debug) {
							console.log("[SqliteWorkerClient] started with dbId:", this.dbId);
							console.log(
								"[SqliteWorkerClient] calling on started callback",
								this.onStartedCallback,
							);
						}
						this.onStartedCallback?.();
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
			case SqliteWorkerServerMessageType.CheckpointComplete:
				{
					// Checkpoint completed successfully
					if (this.debug) {
						console.log(
							"[SqliteWorkerClient] checkpoint complete:",
							message.id,
						);
					}
				}
				break;
			case SqliteWorkerServerMessageType.CheckpointError:
				{
					// Checkpoint failed
					if (this.debug) {
						console.error(
							"[SqliteWorkerClient] checkpoint error:",
							message.error,
						);
					}
				}
				break;
			default:
				return exhaustiveGuard(type);
		}
	}

	public performRemoteCallback(
		data: Omit<SqliteWorkerRemoteCallbackClientMessage, "type" | "id" | "dbId">,
		resolve: (value: { rows: unknown[] }) => void,
		reject: (error: Error) => void,
	) {
		if (!this.dbId) {
			reject(new Error("Database not started - dbId is null"));
			return;
		}

		if (this.debug) {
			console.log(
				`[${new Date().toISOString()}] [SqliteWorkerClient] performing remote callback`,
				data,
			);
		}
		const id = RemoteCallbackIdSchema.parse(crypto.randomUUID());
		if (this.debug) {
			console.log(
				`[${new Date().toISOString()}] [SqliteWorkerClient] remote callback id`,
				id,
			);
		}
		this.remoteCallbacks.set(id, { resolve, reject });
		this.send({
			type: SqliteWorkerClientMessageType.RemoteCallbackRequest,
			id,
			dbId: this.dbId,
			sql: data.sql,
			params: data.params,
			method: data.method,
		});
	}

	public onStarted(callback: () => void) {
		if (this.debug) {
			console.log(
				`[${new Date().toISOString()}] [SqliteWorkerClient] on started callback`,
				callback,
			);
		}
		this.onStartedCallback = callback;
	}

	public override terminate() {
		super.terminate();
	}
}
