// SqliteRemoteDatabase<TSchema extends Record<string, unknown>

import type {
	DrizzleTypeError,
	ExtractTablesWithRelations,
	TablesRelationalConfig,
} from "drizzle-orm";
import type { RelationalQueryBuilder } from "drizzle-orm/sqlite-core/query-builders/query";
// import type { RelationalQueryBuilder } from "drizzle-orm/sqlite-core/query-builders/query";
import { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";

// export declare class RelationalQueryBuilder<TMode extends 'sync' | 'async', TFullSchema extends Record<string, unknown>, TSchema extends TablesRelationalConfig, TFields extends TableRelationalConfig> {
//     protected mode: TMode;
//     protected fullSchema: Record<string, unknown>;
//     protected schema: TSchema;
//     protected tableNamesMap: Record<string, string>;
//     protected table: SQLiteTable;
//     protected tableConfig: TableRelationalConfig;
//     protected dialect: SQLiteDialect;
//     protected session: SQLiteSession<'async', unknown, TFullSchema, TSchema>;
//     static readonly [entityKind]: string;
//     constructor(mode: TMode, fullSchema: Record<string, unknown>, schema: TSchema, tableNamesMap: Record<string, string>, table: SQLiteTable, tableConfig: TableRelationalConfig, dialect: SQLiteDialect, session: SQLiteSession<'async', unknown, TFullSchema, TSchema>);
//     findMany<TConfig extends DBQueryConfig<'many', true, TSchema, TFields>>(config?: KnownKeysOnly<TConfig, DBQueryConfig<'many', true, TSchema, TFields>>): SQLiteRelationalQueryKind<TMode, BuildQueryResult<TSchema, TFields, TConfig>[]>;
//     findFirst<TSelection extends Omit<DBQueryConfig<'many', true, TSchema, TFields>, 'limit'>>(config?: KnownKeysOnly<TSelection, Omit<DBQueryConfig<'many', true, TSchema, TFields>, 'limit'>>): SQLiteRelationalQueryKind<TMode, BuildQueryResult<TSchema, TFields, TSelection> | undefined>;
// }

type LiveSqliteDrizzle<
	TFullSchema extends Record<string, unknown> = Record<string, never>,
	TSchema extends
		TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
> = {
	query: TSchema extends Record<string, never>
		? DrizzleTypeError<"Seems like the schema generic is missing - did you forget to add it to your DB type?">
		: {
				[K in keyof TSchema]: {
					findMany: InstanceType<
						typeof RelationalQueryBuilder<
							"async",
							TFullSchema,
							TSchema,
							TSchema[K]
						>
					>["findMany"];
					findFirst: InstanceType<
						typeof RelationalQueryBuilder<
							"async",
							TFullSchema,
							TSchema,
							TSchema[K]
						>
					>["findFirst"];
				};
			};
};
