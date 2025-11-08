/**
 * Formats a date with millisecond precision using the user's locale
 */
export function formatDateWithMs(date: Date | number): string {
	return new Date(date).toLocaleString(undefined, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		fractionalSecondDigits: 3,
	});
}
