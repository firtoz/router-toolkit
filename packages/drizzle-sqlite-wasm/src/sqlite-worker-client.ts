import { exhaustiveGuard } from "@firtoz/maybe-error";
import { WorkerClient } from "packages/worker-helper/src";
import {
	type SqliteWorkerClientMessage,
	type SqliteWorkerServerMessage,
	type RemoteCallbackId,
	SqliteWorkerClientMessageSchema,
	sqliteWorkerServerMessage,
	SqliteWorkerServerMessageType,
	SqliteWorkerClientMessageType,
	type SqliteWorkerRemoteCallbackClientMessage,
	RemoteCallbackIdSchema,
} from "./sqlite-worker-schema";

export class SqliteWorkerClient extends WorkerClient<
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

	private onStartedCallback?: () => void;

	constructor(
		worker: Worker,
		private readonly dbName: string,
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
					console.log("[SqliteWorkerClient] ready");
					this.send({
						type: SqliteWorkerClientMessageType.Start,
						dbName: this.dbName,
					});
				}
				break;
			case SqliteWorkerServerMessageType.Started:
				{
					console.log("[SqliteWorkerClient] started");
				}

				console.log(
					"[SqliteWorkerClient] calling on started callback",
					this.onStartedCallback,
				);

				this.onStartedCallback?.();
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

	public performRemoteCallback(
		data: Omit<SqliteWorkerRemoteCallbackClientMessage, "type" | "id">,
		resolve: (value: { rows: unknown[] }) => void,
		reject: (error: Error) => void,
	) {
		console.log(
			`[${new Date().toISOString()}] [SqliteWorkerClient] performing remote callback`,
			data,
		);
		const id = RemoteCallbackIdSchema.parse(crypto.randomUUID());
		console.log(
			`[${new Date().toISOString()}] [SqliteWorkerClient] remote callback id`,
			id,
		);
		this.remoteCallbacks.set(id, { resolve, reject });
		this.send({
			type: SqliteWorkerClientMessageType.RemoteCallbackRequest,
			id,
			sql: data.sql,
			params: data.params,
			method: data.method,
		});
	}

	public onStarted(callback: () => void) {
		console.log("[SqliteWorkerClient] on started callback", callback);
		this.onStartedCallback = callback;
	}

	public override terminate() {
		super.terminate();
	}
}
