// Shared types for Drizzle migrations across different database backends

// ============================================================================
// Journal Types
// ============================================================================

export interface JournalEntry {
	idx: number;
	version: string;
	when: number;
	tag: string;
	breakpoints: boolean;
}

export interface Journal {
	version: string;
	dialect: string;
	entries: JournalEntry[];
}

// ============================================================================
// Schema Definition Types
// ============================================================================

export type SqliteColumnType = "text" | "integer" | "real" | "blob" | "numeric";

export interface ColumnDefinition {
	name: string;
	type: SqliteColumnType | string;
	primaryKey: boolean;
	notNull: boolean;
	autoincrement: boolean;
	default?: string | number | boolean | null;
}

export interface IndexDefinition {
	name: string;
	columns: string[];
	isUnique: boolean;
}

export interface ForeignKeyDefinition {
	name: string;
	tableFrom: string;
	tableTo: string;
	columnsFrom: string[];
	columnsTo: string[];
	onDelete?: "cascade" | "set null" | "set default" | "restrict" | "no action";
	onUpdate?: "cascade" | "set null" | "set default" | "restrict" | "no action";
}

export interface CompositePrimaryKeyDefinition {
	name: string;
	columns: string[];
}

export interface UniqueConstraintDefinition {
	name: string;
	columns: string[];
}

export interface CheckConstraintDefinition {
	name: string;
	value: string;
}

export interface TableDefinition {
	name: string;
	columns: Record<string, ColumnDefinition>;
	indexes: Record<string, IndexDefinition>;
	foreignKeys: Record<string, ForeignKeyDefinition>;
	compositePrimaryKeys: Record<string, CompositePrimaryKeyDefinition>;
	uniqueConstraints: Record<string, UniqueConstraintDefinition>;
	checkConstraints: Record<string, CheckConstraintDefinition>;
}

export interface ViewDefinition {
	name: string;
	query: string;
	columns: Record<string, { name: string; type: string }>;
}

export interface EnumDefinition {
	name: string;
	values: string[];
}

export interface SnapshotMeta {
	schemas: Record<string, unknown>;
	tables: Record<string, unknown>;
	columns: Record<string, string>; // Old column name -> new column name
}

export interface SnapshotInternal {
	indexes: Record<string, unknown>;
}

export interface Snapshot {
	version: string;
	dialect: string;
	id: string;
	prevId: string;
	tables: Record<string, TableDefinition>;
	views: Record<string, ViewDefinition>;
	enums: Record<string, EnumDefinition>;
	_meta: SnapshotMeta;
	internal: SnapshotInternal;
}
