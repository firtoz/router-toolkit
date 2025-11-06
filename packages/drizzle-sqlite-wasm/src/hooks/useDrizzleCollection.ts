import { createCollection } from "@tanstack/db";
import { useMemo } from "react";
import {
	type AnyDrizzleDatabase,
	type ValidTableNames,
	type DrizzleSchema,
	type DrizzleCollectionConfig,
	drizzleCollectionOptions,
} from "../collections/drizzle-collection";

export const useDrizzleCollection = <
	const TDrizzle extends AnyDrizzleDatabase,
	const TTableName extends string & ValidTableNames<DrizzleSchema<TDrizzle>>,
>(
	config: DrizzleCollectionConfig<TDrizzle, TTableName>,
) => {
	return useMemo(() => {
		return createCollection(
			drizzleCollectionOptions({
				drizzle: config.drizzle,
				tableName: config.tableName,
			}),
		);
	}, [config.drizzle, config.tableName]);
};
