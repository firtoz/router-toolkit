import { useContext, useCallback } from "react";
import type { DrizzleContextValue } from "./DrizzleProvider";
import {
	DrizzleContext,
	useCollection as useCollectionImpl,
} from "./DrizzleProvider";
import type { ValidTableNames } from "../collections/drizzle-collection";

export interface UseDrizzleContextReturn<
	TSchema extends Record<string, unknown>,
> {
	drizzle: DrizzleContextValue<TSchema>["drizzle"];
	useCollection: <TTableName extends string & ValidTableNames<TSchema>>(
		tableName: TTableName,
	) => ReturnType<typeof useCollectionImpl<TSchema, TTableName>>;
}

export function useDrizzleContext<
	TSchema extends Record<string, unknown>,
>(): UseDrizzleContextReturn<TSchema> {
	const context = useContext(DrizzleContext);

	if (!context) {
		throw new Error("useDrizzleContext must be used within a DrizzleProvider");
	}

	const typedContext = context as DrizzleContextValue<TSchema>;

	// Create a wrapper function that uses the useCollection hook
	const useCollection = useCallback(
		<TTableName extends string & ValidTableNames<TSchema>>(
			tableName: TTableName,
		) => {
			return useCollectionImpl(typedContext, tableName);
		},
		[typedContext],
	);

	return {
		drizzle: typedContext.drizzle,
		useCollection,
	};
}
