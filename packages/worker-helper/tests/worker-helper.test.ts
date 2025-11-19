import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod/v4";

// Worker is a global in Bun, no need to import

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
]);

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

describe("WorkerHelper", () => {
	let worker: Worker;

	beforeEach(() => {
		// Create a new worker for each test
		worker = new Worker(
			new URL("./test-worker.worker.ts", import.meta.url).href,
		);
	});

	afterEach(() => {
		worker.terminate();
	});

	describe("successful message handling", () => {
		it("should handle add operation", async () => {
			const result = await new Promise<Output>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "add",
					a: 5,
					b: 3,
				} satisfies Input);
			});

			expect(result).toEqual({
				type: "result",
				value: 8,
			});
		});

		it("should handle multiply operation", async () => {
			const result = await new Promise<Output>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "multiply",
					a: 4,
					b: 7,
				} satisfies Input);
			});

			expect(result).toEqual({
				type: "result",
				value: 28,
			});
		});

		it("should handle echo operation", async () => {
			const result = await new Promise<Output>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "echo",
					message: "Hello, Worker!",
				} satisfies Input);
			});

			expect(result).toEqual({
				type: "echo",
				message: "Hello, Worker!",
			});
		});

		it("should handle multiple sequential messages", async () => {
			const results: Output[] = [];
			const expectedCount = 3;

			await new Promise<void>((resolve) => {
				let count = 0;
				const handler = (event: MessageEvent) => {
					results.push(event.data);
					count++;
					if (count === expectedCount) {
						worker.removeEventListener("message", handler);
						resolve();
					}
				};
				worker.addEventListener("message", handler);

				worker.postMessage({ type: "add", a: 1, b: 2 } satisfies Input);
				worker.postMessage({ type: "multiply", a: 3, b: 4 } satisfies Input);
				worker.postMessage({
					type: "echo",
					message: "test",
				} satisfies Input);
			});

			expect(results).toHaveLength(3);
			expect(results[0]).toEqual({ type: "result", value: 3 });
			expect(results[1]).toEqual({ type: "result", value: 12 });
			expect(results[2]).toEqual({ type: "echo", message: "test" });
		});
	});

	describe("input validation errors", () => {
		it("should handle invalid input type", async () => {
			const result = await new Promise<{ error: string }>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "invalid",
					data: "something",
				});
			});

			expect(result).toHaveProperty("error");
			expect(result.error).toContain("Input validation failed");
		});

		it("should handle missing required fields", async () => {
			const result = await new Promise<{ error: string }>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "add",
					a: 5,
					// missing 'b'
				});
			});

			expect(result).toHaveProperty("error");
			expect(result.error).toContain("Input validation failed");
		});

		it("should handle wrong field types", async () => {
			const result = await new Promise<{ error: string }>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "add",
					a: "not a number",
					b: 5,
				});
			});

			expect(result).toHaveProperty("error");
			expect(result.error).toContain("Input validation failed");
		});

		it("should handle completely invalid input", async () => {
			const result = await new Promise<{ error: string }>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage("just a string");
			});

			expect(result).toHaveProperty("error");
			expect(result.error).toContain("Input validation failed");
		});
	});

	describe("output validation errors", () => {
		it("should handle output validation error from worker", async () => {
			// Create a worker that will try to send invalid output
			const invalidWorker = new Worker(
				new URL("./test-worker-invalid-output.worker.ts", import.meta.url).href,
			);

			try {
				const result = await new Promise<{ error: string }>((resolve) => {
					invalidWorker.addEventListener(
						"message",
						(event: MessageEvent) => {
							resolve(event.data);
						},
						{ once: true },
					);
					invalidWorker.postMessage({
						type: "add",
						a: 5,
						b: 3,
					} satisfies Input);
				});

				expect(result).toHaveProperty("error");
				expect(result.error).toContain("Output validation failed");
			} finally {
				invalidWorker.terminate();
			}
		});
	});

	describe("async operations", () => {
		it("should handle async operations with delays", async () => {
			// Create a worker that uses async handlers with delays
			const asyncWorker = new Worker(
				new URL("./test-worker-async.worker.ts", import.meta.url).href,
			);

			try {
				const startTime = Date.now();
				const result = await new Promise<Output>((resolve) => {
					asyncWorker.addEventListener(
						"message",
						(event: MessageEvent) => {
							resolve(event.data);
						},
						{ once: true },
					);
					asyncWorker.postMessage({
						type: "add",
						a: 10,
						b: 20,
					} satisfies Input);
				});
				const elapsedTime = Date.now() - startTime;

				expect(result).toEqual({
					type: "result",
					value: 30,
				});
				// Should take at least 500ms due to the async delay
				expect(elapsedTime).toBeGreaterThanOrEqual(500);
			} finally {
				asyncWorker.terminate();
			}
		});

		it("should handle async errors", async () => {
			// Create a worker that uses async handlers
			const asyncWorker = new Worker(
				new URL("./test-worker-async.worker.ts", import.meta.url).href,
			);

			try {
				const result = await new Promise<{ error: string }>((resolve) => {
					asyncWorker.addEventListener(
						"message",
						(event: MessageEvent) => {
							resolve(event.data);
						},
						{ once: true },
					);
					asyncWorker.postMessage({
						type: "error",
						shouldThrow: true,
					} satisfies Input);
				});

				expect(result).toHaveProperty("error");
				expect(result.error).toContain("Processing error");
			} finally {
				asyncWorker.terminate();
			}
		});
	});

	describe("processing errors", () => {
		it("should handle errors thrown during message processing", async () => {
			const result = await new Promise<{ error: string }>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "error",
					shouldThrow: true,
				} satisfies Input);
			});

			expect(result).toHaveProperty("error");
			expect(result.error).toContain("Processing error");
			expect(result.error).toContain("Intentional error");
		});
	});

	describe("edge cases", () => {
		it("should handle empty messages that match schema", async () => {
			const result = await new Promise<Output>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "echo",
					message: "",
				} satisfies Input);
			});

			expect(result).toEqual({
				type: "echo",
				message: "",
			});
		});

		it("should handle zero values", async () => {
			const result = await new Promise<Output>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "add",
					a: 0,
					b: 0,
				} satisfies Input);
			});

			expect(result).toEqual({
				type: "result",
				value: 0,
			});
		});

		it("should handle negative numbers", async () => {
			const result = await new Promise<Output>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "multiply",
					a: -5,
					b: 3,
				} satisfies Input);
			});

			expect(result).toEqual({
				type: "result",
				value: -15,
			});
		});

		it("should handle large numbers", async () => {
			const result = await new Promise<Output>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "add",
					a: Number.MAX_SAFE_INTEGER - 1,
					b: 1,
				} satisfies Input);
			});

			expect(result).toEqual({
				type: "result",
				value: Number.MAX_SAFE_INTEGER,
			});
		});

		it("should handle special string characters", async () => {
			const specialMessage = "Hello 🎉\nNew line\tTab\r\nWindows line";
			const result = await new Promise<Output>((resolve) => {
				worker.addEventListener(
					"message",
					(event: MessageEvent) => {
						resolve(event.data);
					},
					{ once: true },
				);
				worker.postMessage({
					type: "echo",
					message: specialMessage,
				} satisfies Input);
			});

			expect(result).toEqual({
				type: "echo",
				message: specialMessage,
			});
		});
	});

	describe("type safety", () => {
		it("should enforce discriminated union types", async () => {
			// This test verifies that the type system prevents invalid combinations
			// TypeScript compilation itself is the test here
			const validInputs: Input[] = [
				{ type: "add", a: 1, b: 2 },
				{ type: "multiply", a: 3, b: 4 },
				{ type: "echo", message: "test" },
				{ type: "error", shouldThrow: false },
			];

			for (const input of validInputs) {
				const result = await new Promise<Output>((resolve) => {
					worker.addEventListener(
						"message",
						(event: MessageEvent) => {
							resolve(event.data);
						},
						{ once: true },
					);
					worker.postMessage(input);
				});

				expect(result).toHaveProperty("type");
			}
		});
	});
});
