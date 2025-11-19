export function exhaustiveGuard(value: never): never {
	throw new Error(`Exhaustive guard triggered with value: ${value}`);
}
