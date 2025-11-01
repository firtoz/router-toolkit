import type { ZodError, ZodType } from "zod/v4";

type MessageTarget = DedicatedWorkerGlobalScope;

export type WorkerHelperHandlers<TInput, TOutput> = {
	handleMessage: (data: TInput) => void | Promise<void>;
	handleInputValidationError: (
		error: ZodError<TInput>,
		originalData: unknown,
	) => void | Promise<void>;
	handleOutputValidationError: (
		error: ZodError<TOutput>,
		originalData: TOutput,
	) => void | Promise<void>;
	handleProcessingError: (
		error: unknown,
		validatedData: TInput,
	) => void | Promise<void>;
};

export abstract class WorkerHelper<TInput, TOutput> {
	constructor(
		private self: MessageTarget,
		private inputSchema: ZodType<TInput>,
		private outputSchema: ZodType<TOutput>,
		private handlers: WorkerHelperHandlers<TInput, TOutput>,
	) {
		this.setupMessageListener();
	}

	protected send = (response: TOutput) => {
		// Validate output before sending
		const outputValidation = this.outputSchema.safeParse(response);
		if (!outputValidation.success) {
			this.handlers.handleOutputValidationError(
				outputValidation.error,
				response,
			);
			return;
		}

		// Send as success response
		this.self.postMessage(response);
	};

	private setupMessageListener(): void {
		this.self.addEventListener("message", (event: MessageEvent) => {
			this.handleMessage(event);
		});
	}

	private async handleMessage(event: MessageEvent): Promise<void> {
		// Validate input using safeParse
		const validationResult = this.inputSchema.safeParse(event.data);

		if (!validationResult.success) {
			await this.handlers.handleInputValidationError(
				validationResult.error,
				event.data,
			);
			return;
		}

		// Handle the validated message
		try {
			await this.handlers.handleMessage(validationResult.data);
		} catch (error) {
			await this.handlers.handleProcessingError(error, validationResult.data);
		}
	}
}
