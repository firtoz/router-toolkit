/**
 * Performance measurement utilities for tracking SQLite WASM initialization
 */

export interface PerformanceMetrics {
	name: string;
	duration: number;
	startTime: number;
}

/**
 * Get all performance measures for a specific database
 */
export function getPerformanceMetrics(dbName: string): PerformanceMetrics[] {
	const measures = performance.getEntriesByType(
		"measure",
	) as PerformanceMeasure[];
	return measures
		.filter((measure) => measure.name.includes(dbName))
		.map((measure) => ({
			name: measure.name,
			duration: measure.duration,
			startTime: measure.startTime,
		}))
		.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Get all performance marks for a specific database
 */
export function getPerformanceMarks(dbName: string): PerformanceMark[] {
	const marks = performance.getEntriesByType("mark") as PerformanceMark[];
	return marks
		.filter((mark) => mark.name.includes(dbName))
		.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Log all performance metrics for a database in a formatted table
 */
export function logPerformanceMetrics(dbName: string) {
	const metrics = getPerformanceMetrics(dbName);

	if (metrics.length === 0) {
		console.log(`[PERF] No performance metrics found for ${dbName}`);
		return;
	}

	console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(`📊 Performance Metrics for: ${dbName}`);
	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

	// Find the end-to-end metric
	const endToEnd = metrics.find((m) => m.name.includes("end-to-end"));

	// Group metrics by category
	const categories = {
		"Worker & SQLite": metrics.filter((m) =>
			m.name.match(/worker|sqlite-wasm|module-load|diagnostics/i),
		),
		"Database Initialization": metrics.filter((m) =>
			m.name.match(/prepare|db-start|db-init/i),
		),
		Migration: metrics.filter((m) => m.name.includes("migration")),
		"Provider & Collections": metrics.filter((m) =>
			m.name.match(/provider|collection/i),
		),
		"Query Execution": metrics.filter((m) => m.name.match(/query/i)),
	};

	// Log each category
	for (const [category, categoryMetrics] of Object.entries(categories)) {
		if (categoryMetrics.length > 0) {
			console.log(`\n${category}:`);
			console.log("─".repeat(60));
			for (const metric of categoryMetrics) {
				const duration = metric.duration.toFixed(2);
				const name = metric.name
					.replace(`${dbName}-`, "")
					.replace("sqlite-wasm-", "");
				console.log(`  ${name.padEnd(40)} ${duration.padStart(10)} ms`);
			}
		}
	}

	// Log end-to-end time prominently
	if (endToEnd) {
		console.log(`\n${"=".repeat(60)}`);
		console.log(
			`🏁 TOTAL INITIALIZATION TIME: ${endToEnd.duration.toFixed(2)} ms`,
		);
		console.log(`${"=".repeat(60)}\n`);
	}
}

/**
 * Export performance data as JSON for analysis
 */
export function exportPerformanceData(dbName: string) {
	const metrics = getPerformanceMetrics(dbName);
	const marks = getPerformanceMarks(dbName);

	return {
		dbName,
		timestamp: new Date().toISOString(),
		metrics,
		marks,
	};
}

/**
 * Clear all performance marks and measures for a database
 */
export function clearPerformanceData(dbName: string) {
	const entries = performance.getEntries();
	for (const entry of entries) {
		if (entry.name.includes(dbName)) {
			performance.clearMarks(entry.name);
			performance.clearMeasures(entry.name);
		}
	}
}

/**
 * Create a performance observer to automatically log metrics as they complete
 */
export function createPerformanceObserver(
	dbName: string,
	onMeasure?: (measure: PerformanceMeasure) => void,
): PerformanceObserver {
	const observer = new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			if (entry.entryType === "measure" && entry.name.includes(dbName)) {
				const measure = entry as PerformanceMeasure;
				console.log(`[PERF] ${measure.name}: ${measure.duration.toFixed(2)}ms`);
				onMeasure?.(measure);

				// If this is the end-to-end measure, log the full report
				if (measure.name.includes("end-to-end")) {
					setTimeout(() => {
						logPerformanceMetrics(dbName);
					}, 100);
				}
			}
		}
	});

	observer.observe({ entryTypes: ["measure"] });
	return observer;
}
