/**
 * Date encoding for on-chain storage (uint256).
 *
 * Stores dates as YYYYMMDD integers so that pre-1970 dates
 * (common in family trees) remain positive and fit in uint256.
 *
 * Examples:
 *   "1959-01-27" → 19590127n
 *   "2024-12-25" → 20241225n
 */

/** Convert an HTML date input value ("YYYY-MM-DD") to a YYYYMMDD bigint. */
export function dateInputToUint(dateStr: string): bigint {
  if (!dateStr) return 0n;
  // dateStr is "YYYY-MM-DD" from <input type="date">
  const [y, m, d] = dateStr.split("-").map(Number);
  return BigInt(y * 10000 + m * 100 + d);
}

/** Convert a YYYYMMDD bigint back to a formatted date string. */
export function uintToDateString(dob: bigint, style: "short" | "long" = "short"): string {
  if (dob === 0n) return "Unknown";

  const n = Number(dob);
  const day = n % 100;
  const month = Math.floor((n % 10000) / 100);
  const year = Math.floor(n / 10000);

  if (month < 1 || month > 12 || day < 1 || day > 31) return "Unknown";

  const date = new Date(year, month - 1, day);
  // Correct for years 0-99 which Date treats as 1900-1999
  date.setFullYear(year);

  if (style === "long") {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
