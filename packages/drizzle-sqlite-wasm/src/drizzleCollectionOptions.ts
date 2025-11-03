// const selectSchema = createSelectSchema(todoTable);

import type { CollectionConfig, InferSchemaOutput } from "@tanstack/db";
import type { Column, Table } from "drizzle-orm";
import type {
	SQLiteTableWithColumns,
	TableConfig,
} from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-zod";

export function drizzleCollectionOptions<
	TTable extends Table &
		SQLiteTableWithColumns<
			Pick<TableConfig, "name" | "schema" | "dialect"> & {
				columns: {
					id: Column & {
						dataType: "string";
					};
					createdAt: Column & {
						dataType: "date";
						columnType: "SQLiteTimestamp";
						// notNull: true;
					};
					updatedAt: Column & {
						dataType: "date";
						columnType: "SQLiteTimestamp";
						// notNull: true;
					};
					deletedAt: Column & {
						dataType: "date";
						columnType: "SQLiteTimestamp";
					};
				};
			}
		>,
>(config: {
	table: TTable;
}): CollectionConfig<
	InferSchemaOutput<typeof selectSchema>,
	string | number,
	typeof selectSchema
> & {
	schema: typeof selectSchema;
} {
	const selectSchema = createSelectSchema(config.table);
	throw new Error("Not implemented");
	// return {
	//     id: table.name,
	//     schema: createSelectSchema(table),
	// };
}
