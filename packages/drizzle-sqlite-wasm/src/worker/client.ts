import type { SqliteWorkerRemoteCallbackClientMessage } from "./schema";

export interface ISqliteWorkerClient {
	performRemoteCallback: (
		data: Omit<SqliteWorkerRemoteCallbackClientMessage, "type" | "id" | "dbId">,
		resolve: (value: { rows: unknown[] }) => void,
		reject: (error: Error) => void,
	) => void;
	onStarted: (callback: () => void) => void;
	terminate: () => void;
}
