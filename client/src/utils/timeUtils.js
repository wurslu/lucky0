// client/src/utils/timeUtils.js (简化版)
/**
 * 时间处理工具函数
 * 统一管理项目中的时间处理逻辑
 */

/**
 * 格式化时间字符串，移除Z后缀
 * @param {string|Date} time 时间字符串或Date对象
 * @returns {string} 处理后的时间字符串
 */
export const formatTime = (time) => {
  if (!time) return "";
  try {
    let timeStr = time;
    if (time instanceof Date) {
      timeStr = time.toISOString();
    }
    return typeof timeStr === "string" ? timeStr.replace("Z", "") : "";
  } catch (error) {
    console.error("格式化时间出错:", error);
    return "";
  }
};

/**
 * 判断时间是否已过期
 * @param {string|Date} time 时间字符串或Date对象
 * @returns {boolean} 是否已过期
 */
export const isExpired = (time) => {
  if (!time) return false;
  try {
    const targetTime = new Date(formatTime(time));
    return new Date() >= targetTime;
  } catch (error) {
    console.error("判断过期出错:", error);
    return false;
  }
};

/**
 * 获取当前时间字符串 (不带Z后缀)
 * @returns {string} 当前时间字符串
 */
export const getNowString = () => {
  return new Date().toISOString().replace("Z", "");
};

/**
 * 将时间字符串转换为中国标准时间格式
 * @param {string|Date} time 时间字符串或Date对象
 * @returns {string} 中国时间格式字符串 (YYYY-MM-DD HH:mm:ss)
 */
export const formatChineseTime = (time) => {
  if (!time) return "";
  try {
    const date = new Date(formatTime(time));
    if (isNaN(date.getTime())) return "";

    return date
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
    console.error("格式化中国时间出错:", error);
    return "";
  }
};

/**
 * 简短的中国时间格式
 * @param {string|Date} time 时间字符串或Date对象
 * @returns {string} 简短格式 (MM-DD HH:mm)
 */
export const formatShortChineseTime = (time) => {
  if (!time) return "";
  try {
    const date = new Date(formatTime(time));
    if (isNaN(date.getTime())) return "";

    return date
      .toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-");
  } catch (error) {
    console.error("格式化简短中国时间出错:", error);
    return "";
  }
};

/**
 * 获取倒计时字符串
 * @param {string|Date} endTime 结束时间
 * @returns {string} 倒计时字符串
 */
export const getCountdownString = (endTime) => {
  if (!endTime) return "00:00:00";
  try {
    const end = new Date(formatTime(endTime));
    const now = new Date();

    if (isNaN(end.getTime()) || now >= end) {
      return "00:00:00";
    }

    const diff = end - now;
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
    console.error("获取倒计时字符串出错:", error);
    return "00:00:00";
  }
};

/**
 * 将日期和时间组合成标准格式
 * @param {string} date 日期字符串 (YYYY-MM-DD)
 * @param {string} time 时间字符串 (HH:mm)
 * @returns {string} 组合后的时间字符串
 */
export const combineDateTime = (date, time) => {
  try {
    const timeFormat = time.includes(":")
      ? time.split(":").length === 2
        ? `${time}:00`
        : time
      : `${time}:00`;

    return `${date}T${timeFormat}`;
  } catch (error) {
    console.error("组合日期时间出错:", error);
    return "";
  }
};

/**
 * 获取未来时间
 * @param {number} minutesToAdd 要添加的分钟数
 * @returns {object} 包含date和time的对象
 */
export const getFutureDateTime = (minutesToAdd) => {
  try {
    const futureTime = new Date(Date.now() + minutesToAdd * 60000);
    const date = futureTime.toISOString().split("T")[0];
    const hours = String(futureTime.getHours()).padStart(2, "0");
    const minutes = String(futureTime.getMinutes()).padStart(2, "0");
    const time = `${hours}:${minutes}`;
    return { date, time };
  } catch (error) {
    console.error("获取未来时间出错:", error);
    return { date: "", time: "" };
  }
};

// 导出所有函数
export default {
  formatTime,
  isExpired,
  getNowString,
  formatChineseTime,
  formatShortChineseTime,
  getCountdownString,
  combineDateTime,
  getFutureDateTime,
};
