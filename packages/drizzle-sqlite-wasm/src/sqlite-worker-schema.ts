import z from "zod";

export const RemoteCallbackIdSchema = z.string().brand("remote-callback-id");
export type RemoteCallbackId = z.infer<typeof RemoteCallbackIdSchema>;

export enum SqliteWorkerClientMessageType {
	Start = "start",
	RemoteCallbackRequest = "remote-callback-request",
}

export enum SqliteWorkerServerMessageType {
	Ready = "ready",
	Started = "started",
	RemoteCallbackResponse = "remote-callback-response",
	RemoteCallbackError = "remote-callback-error",
}

export const RemoteCallbackRequestSchema = z.object({
	type: z.literal(SqliteWorkerClientMessageType.RemoteCallbackRequest),
	// AsyncRemoteCallback
	// sql: string, params: any[], method: 'run' | 'all' | 'values' | 'get'
	id: RemoteCallbackIdSchema,
	sql: z.string(),
	params: z.array(z.any()),
	method: z.enum(["run", "all", "values", "get"]),
});

export type SqliteWorkerRemoteCallbackClientMessage = z.infer<
	typeof RemoteCallbackRequestSchema
>;

export const SqliteWorkerClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(SqliteWorkerClientMessageType.Start),
		dbName: z.string(),
	}),
	RemoteCallbackRequestSchema,
]);

export const RemoteCallbackResponseSchema = z.object({
	type: z.literal(SqliteWorkerServerMessageType.RemoteCallbackResponse),
	id: RemoteCallbackIdSchema,
	rows: z.array(z.any()),
});

export const RemoteCallbackErrorServerMessageSchema = z.object({
	type: z.literal(SqliteWorkerServerMessageType.RemoteCallbackError),
	id: RemoteCallbackIdSchema,
	error: z.string(),
});

export const sqliteWorkerServerMessage = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(SqliteWorkerServerMessageType.Ready),
	}),
	z.object({
		type: z.literal(SqliteWorkerServerMessageType.Started),
	}),
	RemoteCallbackResponseSchema,
	RemoteCallbackErrorServerMessageSchema,
]);

export type SqliteWorkerClientMessage = z.infer<
	typeof SqliteWorkerClientMessageSchema
>;

export type SqliteWorkerServerMessage = z.infer<
	typeof sqliteWorkerServerMessage
>;

export type SqliteClientRemoteCallbackServerMessage = z.infer<
	typeof RemoteCallbackResponseSchema
>;
