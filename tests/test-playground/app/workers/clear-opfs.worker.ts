// Worker for clearing OPFS storage
// This is needed because OPFS synchronous access (used by SQLite) is only available in workers

import { WorkerHelper } from "@firtoz/worker-helper";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import {
	ClearOpfsClientMessageSchema,
	ClearOpfsServerMessageSchema,
	ClearOpfsClientMessageType,
	ClearOpfsServerMessageType,
	type ClearOpfsClientMessage,
	type ClearOpfsServerMessage,
} from "./clear-opfs.schema";

class ClearOpfsWorkerHelper extends WorkerHelper<
	ClearOpfsClientMessage,
	ClearOpfsServerMessage
> {
	constructor() {
		super(self, ClearOpfsClientMessageSchema, ClearOpfsServerMessageSchema, {
			handleMessage: (data) => {
				this._handleMessage(data);
			},
			handleInputValidationError: (error, originalData) => {
				console.error("Input validation error", { error, originalData });
			},
			handleOutputValidationError: (error, originalData) => {
				console.error("Output validation error", { error, originalData });
			},
			handleProcessingError: (error, validatedData) => {
				console.error("Processing error", { error, validatedData });
			},
		});

		// Send ready message
		this.send({
			type: ClearOpfsServerMessageType.Ready,
		});
	}

	private async clearOPFS() {
		try {
			const root = await navigator.storage.getDirectory();
			let count = 0;

			// @ts-expect-error - OPFS API not fully typed
			for await (const entry of root.values()) {
				try {
					await root.removeEntry(entry.name, { recursive: true });
					count++;
					console.log(`Cleared OPFS entry: ${entry.name}`);
				} catch (e) {
					console.error(`Failed to remove ${entry.name}:`, e);
				}
			}

			this.send({
				type: ClearOpfsServerMessageType.Cleared,
				count,
			});
		} catch (error) {
			this.send({
				type: ClearOpfsServerMessageType.Error,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private async _handleMessage(data: ClearOpfsClientMessage) {
		const { type } = data;
		switch (type) {
			case ClearOpfsClientMessageType.Clear:
				await this.clearOPFS();
				break;
			default:
				return exhaustiveGuard(type);
		}
	}
}

new ClearOpfsWorkerHelper();
