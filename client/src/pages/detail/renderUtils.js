import React from "react";
import { View, Text, Image } from "@tarojs/components";

/**
 * 安全地解析日期字符串，兼容iOS
 * @param {string} dateString - 日期字符串
 * @returns {Date} - 解析后的Date对象
 */
function parseDate(dateString) {
  if (!dateString) return null;

  // 尝试转换为iOS支持的格式
  // 将 "YYYY-MM-DD HH:MM:SS" 转换为 "YYYY/MM/DD HH:MM:SS"
  if (dateString.includes(" ") && dateString.includes("-")) {
    const fixedDateString = dateString.replace(/-/g, "/");
    return new Date(fixedDateString);
  }

  // 如果已经是斜杠格式或其他格式，直接尝试解析
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // 如果仍然失败，尝试手动解析
  const parts = dateString.split(/[- :]/);
  if (parts.length >= 6) {
    // YYYY-MM-DD HH:MM:SS
    return new Date(
      parts[0],
      parts[1] - 1,
      parts[2],
      parts[3],
      parts[4],
      parts[5]
    );
  } else if (parts.length >= 3) {
    // YYYY-MM-DD
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  // 都失败则返回null
  return null;
}

/**
 * 检查抽奖是否已结束
 * @param {string} endTimeString - 结束时间字符串
 * @returns {boolean} - 是否已结束
 */
export function isLotteryEnded(endTimeString) {
  if (!endTimeString) return false;

  const endTime = parseDate(endTimeString);
  if (!endTime) return false;

  const now = new Date();
  return now >= endTime;
}

/**
 * 计算倒计时
 * @param {string} endTimeString - 结束时间字符串
 * @returns {object} - 包含剩余时间的对象
 */
export function calculateTimeDifference(endTimeString) {
  if (!endTimeString) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const endTime = parseDate(endTimeString);
  if (!endTime) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const now = new Date();
  let difference = endTime - now;

  // 已经结束
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  }

  // 计算时间差
  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  difference -= days * (1000 * 60 * 60 * 24);

  const hours = Math.floor(difference / (1000 * 60 * 60));
  difference -= hours * (1000 * 60 * 60);

  const minutes = Math.floor(difference / (1000 * 60));
  difference -= minutes * (1000 * 60);

  const seconds = Math.floor(difference / 1000);

  return { days, hours, minutes, seconds, ended: false };
}

/**
 * 获取倒计时字符串
 */
export function getCountdownString(endTimeString) {
  const time = calculateTimeDifference(endTimeString);
  if (time.ended) return "已结束";

  let result = "";
  if (time.days > 0) {
    result += `${time.days}天`;
  }

  return `${result}${time.hours.toString().padStart(2, "0")}:${time.minutes
    .toString()
    .padStart(2, "0")}:${time.seconds.toString().padStart(2, "0")}`;
}

/**
 * 格式化日期为iOS兼容格式（使用斜杠分隔符）
 * @param {string} dateString - 原始日期字符串
 * @returns {string} - 格式化后的日期字符串
 */
export function formatDateForIOS(dateString) {
  const date = parseDate(dateString);
  if (!date) return "";

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 渲染中奖结果列表
 */
export const renderWinners = (
  lotteryInfo,
  isLotteryEnded,
  handleImageError,
  handleManualRefresh
) => {
  if (!lotteryInfo) {
    return null;
  }

  // 判断抽奖是否已结束
  const ended = isLotteryEnded(lotteryInfo.endTime);

  if (!ended) {
    console.log("抽奖未结束，不显示中奖名单");
    return null;
  }

  // 处理抽奖已结束但未开奖状态
  if (!lotteryInfo.hasDrawn) {
    return (
      <View className="winners-section">
        <Text className="section-title">开奖状态</Text>
        <View className="no-winners-tip">
          <Text className="no-winners-text">抽奖已结束，正在等待系统开奖</Text>
          <View className="refresh-btn" onClick={handleManualRefresh}>
            <Text className="refresh-text">点击刷新</Text>
          </View>
        </View>
      </View>
    );
  }

  // 处理已开奖但无人参与的情况
  if (lotteryInfo.noParticipants) {
    return (
      <View className="winners-section">
        <Text className="section-title">开奖结果</Text>
        <View className="no-winners-tip">
          <Text className="no-winners-text">本次抽奖无人参与，无中奖者</Text>
        </View>
      </View>
    );
  }

  // 处理有中奖者的情况
  if (lotteryInfo.winners && lotteryInfo.winners.length > 0) {
    console.log("显示中奖名单, 人数:", lotteryInfo.winners.length);

    return (
      <View className="winners-section">
        <Text className="section-title">中奖名单</Text>
        <View className="winners-list">
          {lotteryInfo.winners.map((winner, index) => (
            <View key={index} className="winner-item">
              <Image
                className="winner-avatar"
                src={
                  winner.avatarUrl ||
                  "https://mmbiz.qlogo.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0"
                }
                onError={handleImageError}
              />
              <Text className="winner-name">
                {winner.nickName || "幸运用户"}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // 已开奖但没有中奖信息（可能是数据问题）
  return (
    <View className="winners-section">
      <Text className="section-title">开奖结果</Text>
      <View className="no-winners-tip">
        <Text className="no-winners-text">
          开奖已完成，但系统未能找到中奖信息
        </Text>
        <View className="refresh-btn" onClick={handleManualRefresh}>
          <Text className="refresh-text">点击刷新</Text>
        </View>
      </View>
    </View>
  );
};
