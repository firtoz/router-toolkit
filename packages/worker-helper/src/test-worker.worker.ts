import { z } from "zod/v4";
import { WorkerHelper } from "./worker-helper";

// Declare self as Worker for TypeScript
declare var self: Worker;

// Define test schemas
const InputSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("add"),
		a: z.number(),
		b: z.number(),
	}),
	z.object({
		type: z.literal("multiply"),
		a: z.number(),
		b: z.number(),
	}),
	z.object({
		type: z.literal("echo"),
		message: z.string(),
	}),
	z.object({
		type: z.literal("error"),
		shouldThrow: z.boolean(),
	}),
]);

const OutputSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("result"),
		value: z.number(),
	}),
	z.object({
		type: z.literal("echo"),
		message: z.string(),
	}),
	z.object({
		type: z.literal("error"),
		message: z.string(),
	}),
	z.object({
		type: z.literal("input-validation-error"),
		error: z.string(),
		originalData: z.unknown(),
	}),
	z.object({
		type: z.literal("output-validation-error"),
		error: z.string(),
		attemptedOutput: z.unknown(),
	}),
	z.object({
		type: z.literal("processing-error"),
		error: z.string(),
		input: z.unknown(),
	}),
]);

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

class TestWorkerHelper extends WorkerHelper<Input, Output> {
	constructor() {
		super(self, InputSchema, OutputSchema, {
			handleMessage: (data) => {
				switch (data.type) {
					case "add":
						this.send({
							type: "result",
							value: data.a + data.b,
						});
						break;
					case "multiply":
						this.send({
							type: "result",
							value: data.a * data.b,
						});
						break;
					case "echo":
						this.send({
							type: "echo",
							message: data.message,
						});
						break;
					case "error":
						if (data.shouldThrow) {
							throw new Error("Intentional error for testing");
						}
						this.send({
							type: "error",
							message: "Error handled without throwing",
						});
						break;
				}
			},
			handleInputValidationError: (error, originalData) => {
				this.send({
					type: "input-validation-error",
					error: `Input validation failed: ${error.message}`,
					originalData,
				});
			},
			handleOutputValidationError: (error, originalData) => {
				this.send({
					type: "output-validation-error",
					error: `Output validation failed: ${error.message}`,
					attemptedOutput: originalData,
				});
			},
			handleProcessingError: (error, validatedData) => {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				this.send({
					type: "processing-error",
					error: `Processing error: ${errorMessage}`,
					input: validatedData,
				});
			},
		});
	}
}

new TestWorkerHelper();
