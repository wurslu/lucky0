// cloud/functions/utils/timeHelper.js
/**
 * 云函数时间工具模块
 * 用于统一处理服务端的时间相关逻辑，解决时区问题
 */

/**
 * 标准化时间字符串，处理可能的时区问题
 * @param {string} timeStr 时间字符串
 * @returns {string} 标准化后的时间字符串
 */
function normalizeTimeString(timeStr) {
	if (!timeStr) return "";

	try {
		// 如果是日期对象，先转为ISO字符串
		if (timeStr instanceof Date) {
			timeStr = timeStr.toISOString();
		}

		// 如果包含Z后缀，移除它以避免时区问题
		if (typeof timeStr === "string" && timeStr.includes("Z")) {
			return timeStr.replace("Z", "");
		}
		return timeStr;
	} catch (error) {
		console.error("标准化时间字符串出错:", error);
		return timeStr;
	}
}

/**
 * 判断时间是否已过期
 * @param {string|Date} timeStr 时间字符串或Date对象
 * @returns {boolean} 是否已过期
 */
function isTimeExpired(timeStr) {
	if (!timeStr) return false;

	try {
		const targetTime = new Date(normalizeTimeString(timeStr));
		const now = new Date();

		// 检查日期是否有效
		if (isNaN(targetTime.getTime())) {
			console.error("无效的时间:", timeStr);
			return false;
		}

		return now >= targetTime;
	} catch (error) {
		console.error("判断时间是否过期出错:", error);
		return false;
	}
}

/**
 * 获取当前标准时间字符串（不带Z后缀）
 * @returns {string} 当前时间的标准字符串
 */
function getCurrentStandardTime() {
	try {
		const now = new Date();
		return now.toISOString().replace("Z", "");
	} catch (error) {
		console.error("获取当前标准时间出错:", error);
		return new Date().toISOString();
	}
}

/**
 * 将日期对象格式化为中国标准时间字符串
 * @param {Date|string} date 日期对象或字符串
 * @returns {string} 格式化后的字符串 (YYYY-MM-DD HH:mm:ss)
 */
function formatToChineseTime(date) {
	try {
		if (typeof date === "string") {
			date = new Date(normalizeTimeString(date));
		}

		if (!(date instanceof Date) || isNaN(date.getTime())) {
			return "";
		}

		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	} catch (error) {
		console.error("格式化中国时间出错:", error);
		return "";
	}
}

/**
 * 日期比较函数 - 检查第一个日期是否晚于第二个日期
 * @param {string|Date} date1 第一个日期
 * @param {string|Date} date2 第二个日期
 * @returns {boolean} 如果date1晚于date2返回true
 */
function isDateAfter(date1, date2) {
	try {
		const d1 = new Date(normalizeTimeString(date1));
		const d2 = new Date(normalizeTimeString(date2));

		if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
			console.error("比较时间时发现无效日期");
			return false;
		}

		return d1 > d2;
	} catch (error) {
		console.error("比较日期出错:", error);
		return false;
	}
}

/**
 * 添加分钟到指定时间
 * @param {string|Date} date 原始时间
 * @param {number} minutes 要添加的分钟数
 * @returns {string} 新的时间字符串
 */
function addMinutes(date, minutes) {
	try {
		const originalDate = new Date(normalizeTimeString(date));
		if (isNaN(originalDate.getTime())) {
			console.error("添加分钟时发现无效日期");
			return "";
		}

		const newDate = new Date(originalDate.getTime() + minutes * 60000);
		return newDate.toISOString().replace("Z", "");
	} catch (error) {
		console.error("添加分钟出错:", error);
		return "";
	}
}

// 导出所有工具函数
module.exports = {
	normalizeTimeString,
	isTimeExpired,
	getCurrentStandardTime,
	formatToChineseTime,
	isDateAfter,
	addMinutes,
};
