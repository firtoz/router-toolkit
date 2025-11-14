import type { Table } from "drizzle-orm";
import type { BuildSchema } from "drizzle-zod";

/**
 * Utility type for branded IDs
 */
export type Branded<T, Brand> = T & { __brand: Brand };

export type IdType = Branded<string, "id">;

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
	undefined,
	undefined
>;

/**
 * Insert schema type helper
 */
export type InsertSchema<TTable extends Table> = BuildSchema<
	"insert",
	TTable["_"]["columns"],
	undefined,
	undefined
>;
