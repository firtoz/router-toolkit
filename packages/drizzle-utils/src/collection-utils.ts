import type { Table } from "drizzle-orm";
import type { BuildSchema } from "drizzle-valibot";
import type { Collection, UtilsRecord } from "@tanstack/db";

/**
 * Utility type for branded IDs
 */
export type Branded<T, Brand> = T & { __brand: Brand };

export type TableId<TTableName extends string> = Branded<
	string,
	`${TTableName}_id`
>;

/**
 * Utility type to extract the ID type from a table
 */
export type IdOf<TTable extends Table> = TTable extends {
	$inferSelect: { id: infer TId extends string | number };
}
	? TId
	: string | number;

/**
 * Utility function to safely create branded IDs
 */
export function makeId<TTable extends Table>(
	_table: TTable,
	value: string,
): IdOf<TTable> {
	return value as IdOf<TTable>;
}

/**
 * Select schema type helper
 */
export type SelectSchema<TTable extends Table> = BuildSchema<
	"select",
	TTable["_"]["columns"],
	undefined
>;

/**
 * Insert schema type helper
 */
export type InsertSchema<TTable extends Table> = BuildSchema<
	"insert",
	TTable["_"]["columns"],
	undefined
>;

/**
 * Helper type to get the table from schema by name
 */
export type GetTableFromSchema<
	TSchema extends Record<string, unknown>,
	TTableName extends keyof TSchema,
> = TSchema[TTableName] extends Table ? TSchema[TTableName] : never;

/**
 * Helper type to infer the collection type from table
 * This provides proper typing for Collection insert/update operations
 */
export type InferCollectionFromTable<TTable extends Table> = Collection<
	TTable["$inferSelect"],
	IdOf<TTable>,
	UtilsRecord,
	SelectSchema<TTable>,
	Omit<
		TTable["$inferInsert"],
		"id"
		// "createdAt" | "updatedAt" | "deletedAt" | "id"
	> & {
		id?: IdOf<TTable>;
	}
>;
