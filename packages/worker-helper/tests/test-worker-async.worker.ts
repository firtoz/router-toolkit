import { z } from "zod/v4";
import { WorkerHelper } from "../src/worker-helper";

// Define test schemas
const InputSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("add"),
		a: z.number(),
		b: z.number(),
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

// Async helper function
async function simulateAsyncWork(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Create WorkerHelper with async handlers
class TestWorkerHelperAsync extends WorkerHelper<Input, Output> {
	constructor() {
		super(self, InputSchema, OutputSchema, {
			handleMessage: async (data) => {
				await simulateAsyncWork(500);

				switch (data.type) {
					case "add":
						this.send({
							type: "result",
							value: data.a + data.b,
						});
						break;

					case "error":
						if (data.shouldThrow) {
							throw new Error("Async error for testing");
						}
						break;
				}
			},

			handleInputValidationError: async (error, originalData) => {
				await simulateAsyncWork(500);
				this.send({
					type: "input-validation-error",
					error: `Input validation failed: ${error.message}`,
					originalData,
				});
			},

			handleOutputValidationError: async (error, originalData) => {
				await simulateAsyncWork(500);
				this.send({
					type: "output-validation-error",
					error: `Output validation failed: ${error.message}`,
					attemptedOutput: originalData,
				});
			},

			handleProcessingError: async (error, validatedData) => {
				await simulateAsyncWork(500);
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

new TestWorkerHelperAsync();
