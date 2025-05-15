// client/src/pages/detail/renderUtils.js (修复版)
import React from "react";
import { View, Text, Image } from "@tarojs/components";

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
