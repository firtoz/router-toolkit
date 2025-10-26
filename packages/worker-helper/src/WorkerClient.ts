import type { ZodType } from "zod/v4";

export interface WorkerClientOptions<TClientMessage, TServerMessage> {
	/**
	 * Worker instance to wrap
	 */
	worker: Worker;
	/**
	 * Schema for validating messages sent to the worker
	 */
	clientSchema: ZodType<TClientMessage>;
	/**
	 * Schema for validating messages received from the worker
	 */
	serverSchema: ZodType<TServerMessage>;
	/**
	 * Callback for validated messages from the worker
	 */
	onMessage?: (message: TServerMessage) => void;
	/**
	 * Callback for when validation fails on incoming messages
	 */
	onValidationError?: (error: Error, rawMessage: unknown) => void;
	/**
	 * Callback for worker errors
	 */
	onError?: (event: ErrorEvent) => void;
}

export class WorkerClient<TClientMessage, TServerMessage> {
	private worker: Worker;
	private readonly clientSchema: ZodType<TClientMessage>;
	private readonly serverSchema: ZodType<TServerMessage>;
	private readonly onMessageCallback?: (message: TServerMessage) => void;
	private readonly onValidationErrorCallback?: (
		error: Error,
		rawMessage: unknown,
	) => void;

	constructor(options: WorkerClientOptions<TClientMessage, TServerMessage>) {
		this.clientSchema = options.clientSchema;
		this.serverSchema = options.serverSchema;
		this.onMessageCallback = options.onMessage;
		this.onValidationErrorCallback = options.onValidationError;
		this.worker = options.worker;

		// Setup event handlers
		this.worker.addEventListener("message", (event: MessageEvent) => {
			this.handleMessage(event);
		});

		if (options.onError) {
			this.worker.addEventListener("error", options.onError);
		}
	}

	private handleMessage(event: MessageEvent): void {
		try {
			// Validate the incoming message
			const validatedMessage = this.serverSchema.parse(event.data);
			this.onMessageCallback?.(validatedMessage);
		} catch (error) {
			// Validation failed
			const validationError =
				error instanceof Error ? error : new Error(String(error));
			this.onValidationErrorCallback?.(validationError, event.data);
		}
	}

	/**
	 * Send a message to the worker with validation
	 */
	public send(message: TClientMessage): void {
		// Validate the outgoing message
		const validatedMessage = this.clientSchema.parse(message);
		this.worker.postMessage(validatedMessage);
	}

	/**
	 * Terminate the worker
	 */
	public terminate(): void {
		this.worker.terminate();
	}

	/**
	 * Get the underlying Worker instance
	 */
	public getWorker(): Worker {
		return this.worker;
	}
}
