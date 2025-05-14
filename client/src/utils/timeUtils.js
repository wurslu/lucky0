// client/src/utils/timeUtils.js
/**
 * 时间处理工具函数
 * 统一管理项目中的时间处理逻辑，解决时区问题
 */

/**
 * 将时间字符串转换为标准中国时间格式
 * @param {string|Date} timeStr 时间字符串或Date对象
 * @returns {string} 格式化后的中国时间字符串 (YYYY-MM-DD HH:mm:ss)
 */
export const formatChineseTime = (timeStr) => {
  if (!timeStr) return "";

  try {
    // 创建日期对象
    const date = new Date(timeStr);

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.error("无效的时间字符串:", timeStr);
      return "";
    }

    // 使用toLocaleString生成中国时间格式
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
 * 生成简短的中国时间格式 (不含年份和秒)
 * @param {string|Date} timeStr 时间字符串或Date对象
 * @returns {string} 简短的中国时间字符串 (MM-DD HH:mm)
 */
export const formatShortChineseTime = (timeStr) => {
  if (!timeStr) return "";

  try {
    const date = new Date(timeStr);

    if (isNaN(date.getTime())) {
      return "";
    }

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
 * 判断时间是否已过期
 * @param {string|Date} timeStr 时间字符串或Date对象
 * @returns {boolean} 是否已过期
 */
export const isTimeExpired = (timeStr) => {
  if (!timeStr) return false;

  try {
    const targetTime = new Date(timeStr);
    const now = new Date();

    return now >= targetTime;
  } catch (error) {
    console.error("判断时间是否过期出错:", error);
    return false;
  }
};

/**
 * 获取倒计时字符串
 * @param {string|Date} endTimeStr 结束时间字符串或Date对象
 * @returns {string} 倒计时字符串 (DD天 HH:mm:ss 或 HH:mm:ss)
 */
export const getCountdownString = (endTimeStr) => {
  if (!endTimeStr) return "00:00:00";

  try {
    const endTime = new Date(endTimeStr);
    const now = new Date();

    // 检查是否有效
    if (isNaN(endTime.getTime())) {
      return "00:00:00";
    }

    // 如果已过期
    if (now >= endTime) {
      return "00:00:00";
    }

    // 计算时间差
    const diff = endTime - now;

    // 计算天、时、分、秒
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // 格式化输出
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
 * 获取当前时间的ISO字符串（移除Z后缀）
 * @returns {string} 当前时间的ISO字符串，不含Z后缀
 */
export const getCurrentISOString = () => {
  try {
    const now = new Date();
    // 移除Z后缀以避免时区问题
    return now.toISOString().replace("Z", "");
  } catch (error) {
    console.error("获取当前ISO字符串出错:", error);
    return new Date().toISOString();
  }
};

/**
 * 标准化时间字符串，去除Z后缀
 * @param {string} timeStr 时间字符串
 * @returns {string} 标准化后的时间字符串
 */
export const normalizeTimeString = (timeStr) => {
  if (!timeStr) return "";

  try {
    if (typeof timeStr === "string" && timeStr.includes("Z")) {
      // 移除Z后缀以避免时区问题
      return timeStr.replace("Z", "");
    }
    return timeStr;
  } catch (error) {
    console.error("标准化时间字符串出错:", error);
    return timeStr;
  }
};

/**
 * 获取未来某个时间点
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

/**
 * 将日期和时间组合成ISO格式的字符串 (不带Z后缀)
 * @param {string} date 日期字符串 (YYYY-MM-DD)
 * @param {string} time 时间字符串 (HH:mm 或 HH:mm:ss)
 * @returns {string} 组合后的ISO格式字符串
 */
export const combineDateTimeToISO = (date, time) => {
  try {
    // 确保时间格式统一
    const formattedTime = time.includes(":")
      ? time.split(":").length === 2
        ? `${time}:00`
        : time
      : `${time}:00`;

    // 组合日期和时间
    return `${date}T${formattedTime}`;
  } catch (error) {
    console.error("组合日期和时间出错:", error);
    return "";
  }
};

export default {
  formatChineseTime,
  formatShortChineseTime,
  isTimeExpired,
  getCountdownString,
  getCurrentISOString,
  normalizeTimeString,
  getFutureDateTime,
  combineDateTimeToISO,
};
