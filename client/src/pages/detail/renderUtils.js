// client/src/pages/detail/renderUtils.js
import React from "react";
import { View, Text, Image } from "@tarojs/components";

/**
 * 渲染中奖结果列表
 */
export const renderWinners = (
  lotteryInfo,
  isLotteryEnded,
  handleImageError
) => {
  if (!lotteryInfo) {
    return null;
  }

  // 判断抽奖是否已结束
  const ended = isLotteryEnded(lotteryInfo.endTimeLocal || lotteryInfo.endTime);

  if (!ended || !lotteryInfo.winners || lotteryInfo.winners.length === 0) {
    console.log("无需显示中奖名单");
    return null;
  }

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
            <Text className="winner-name">{winner.nickName || "幸运用户"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};
