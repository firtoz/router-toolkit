import z from "zod";

export enum ClearOpfsClientMessageType {
	Clear = "clear",
}

export enum ClearOpfsServerMessageType {
	Ready = "ready",
	Cleared = "cleared",
	Error = "error",
}

export const ClearOpfsClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(ClearOpfsClientMessageType.Clear),
	}),
]);

export const ClearOpfsServerMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(ClearOpfsServerMessageType.Ready),
	}),
	z.object({
		type: z.literal(ClearOpfsServerMessageType.Cleared),
		count: z.number(),
	}),
	z.object({
		type: z.literal(ClearOpfsServerMessageType.Error),
		error: z.string(),
	}),
]);

export type ClearOpfsClientMessage = z.infer<
	typeof ClearOpfsClientMessageSchema
>;

export type ClearOpfsServerMessage = z.infer<
	typeof ClearOpfsServerMessageSchema
>;
