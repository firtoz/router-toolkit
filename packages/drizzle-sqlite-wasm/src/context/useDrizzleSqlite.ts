import { useContext, useCallback } from "react";
import type { DrizzleSqliteContextValue } from "./DrizzleSqliteProvider";
import {
	DrizzleSqliteContext,
	useCollection as useCollectionImpl,
} from "./DrizzleSqliteProvider";
import type { ValidTableNames } from "../collections/drizzle-collection";

export interface UseDrizzleContextReturn<
	TSchema extends Record<string, unknown>,
> {
	drizzle: DrizzleSqliteContextValue<TSchema>["drizzle"];
	useCollection: <TTableName extends string & ValidTableNames<TSchema>>(
		tableName: TTableName,
	) => ReturnType<typeof useCollectionImpl<TSchema, TTableName>>;
}

export function useDrizzleSqlite<
	TSchema extends Record<string, unknown>,
>(): UseDrizzleContextReturn<TSchema> {
	const context = useContext(DrizzleSqliteContext);

	if (!context) {
		throw new Error(
			"useDrizzleContext must be used within a DrizzleSqliteProvider",
		);
	}

	const typedContext = context as DrizzleSqliteContextValue<TSchema>;

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
