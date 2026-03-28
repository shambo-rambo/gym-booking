/**
 * Utility functions for handling dates consistently across the application
 * Prevents timezone-related bugs by ensuring dates are parsed correctly
 */

/**
 * Parse a date string (YYYY-MM-DD) into a Date object at UTC midnight
 * This ensures consistent date handling across timezones when storing in the database
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object set to midnight UTC
 */
export function parseLocalDate(dateStr: string): Date {
  // Parse as UTC midnight to avoid timezone shifts
  // This matches how PostgreSQL @db.Date stores dates
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/**
 * Format a Date object to YYYY-MM-DD string for database storage
 *
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForDB(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Compare two dates (ignoring time component)
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}
