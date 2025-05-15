// client/src/utils/timeUtils.js (Simplified version)
/**
 * Time utility functions using simple locale string formatting
 */

/**
 * Format a date to a standard string format (YYYY-MM-DD HH:MM:SS)
 * @param {Date|string} date - Date object or date string to format
 * @returns {string} Formatted date string
 */
export const formatTime = (date) => {
  try {
    // Convert to Date object if it's a string
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj
      .toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-");
  } catch (error) {
    console.error("Error formatting time:", error);
    return "";
  }
};

/**
 * Format a date to Chinese format for display
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string in Chinese format
 */
export const formatChineseTime = (date) => {
  return formatTime(date);
};

/**
 * Format a date to a short Chinese format (MM-DD HH:MM)
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string in short Chinese format
 */
export const formatShortChineseTime = (date) => {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj
      .toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-");
  } catch (error) {
    console.error("Error formatting short time:", error);
    return "";
  }
};

/**
 * Check if a date is in the past
 * @param {Date|string} date - Date object or date string
 * @returns {boolean} True if the date is in the past
 */
export const isExpired = (date) => {
  if (!date) return false;
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj < new Date();
  } catch (error) {
    console.error("Error checking if time is expired:", error);
    return false;
  }
};

/**
 * Get a future date and time based on minutes added to now
 * @param {number} minutesToAdd - Minutes to add to the current time
 * @returns {object} Object with date and time properties
 */
export const getFutureDateTime = (minutesToAdd) => {
  try {
    const futureTime = new Date(Date.now() + minutesToAdd * 60000);

    // Date in YYYY-MM-DD format
    const year = futureTime.getFullYear();
    const month = String(futureTime.getMonth() + 1).padStart(2, "0");
    const day = String(futureTime.getDate()).padStart(2, "0");
    const date = `${year}-${month}-${day}`;

    // Time in HH:MM format
    const hours = String(futureTime.getHours()).padStart(2, "0");
    const minutes = String(futureTime.getMinutes()).padStart(2, "0");
    const time = `${hours}:${minutes}`;

    return { date, time };
  } catch (error) {
    console.error("Error getting future date time:", error);
    return { date: "", time: "" };
  }
};

/**
 * Combine date and time strings into a standard datetime format
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {string} time - Time string in HH:MM format
 * @returns {string} Combined datetime string
 */
export const combineDateTime = (date, time) => {
  try {
    // Make sure time has seconds
    const timeWithSeconds = time.includes(":")
      ? time.split(":").length === 2
        ? `${time}:00`
        : time
      : `${time}:00`;

    // Return a format that can be parsed by new Date()
    return `${date} ${timeWithSeconds}`;
  } catch (error) {
    console.error("Error combining date and time:", error);
    return "";
  }
};

/**
 * Get a countdown string from a future date
 * @param {Date|string} endDate - End date
 * @returns {string} Countdown string in "DD days HH:MM:SS" format
 */
export const getCountdownString = (endDate) => {
  try {
    const endTime = typeof endDate === "string" ? new Date(endDate) : endDate;
    const now = new Date();

    if (isNaN(endTime) || endTime <= now) {
      return "00:00:00";
    }

    const diff = endTime - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${days > 0 ? `${days}天 ` : ""}${hours
      .toString()
      .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  } catch (error) {
    console.error("Error getting countdown string:", error);
    return "00:00:00";
  }
};

export default {
  formatTime,
  formatChineseTime,
  formatShortChineseTime,
  isExpired,
  getFutureDateTime,
  combineDateTime,
  getCountdownString,
};
