// client/src/pages/detail/components/WinningStatus.jsx (修复版)
import React from 'react';
import { View, Text, Button, Image } from '@tarojs/components';

/**
 * 中奖状态组件 - 明确显示用户是否中奖
 */
const WinningStatus = ({
  lotteryInfo,
  userInfo,
  handleManualRefresh,
  handleImageError
}) => {
  if (!lotteryInfo || !lotteryInfo.hasDrawn) return null;

  // 检查当前用户是否已登录
  if (!userInfo) {
    return (
      <View className='winning-status-section'>
        <View className='winning-status-card neutral'>
          <Text className='status-title'>开奖已完成</Text>
          <Text className='status-message'>登录后查看您是否中奖</Text>
          <View className='refresh-btn' onClick={handleManualRefresh}>
            <Text className='refresh-text'>刷新结果</Text>
          </View>
        </View>
      </View>
    );
  }

  // 无人参与抽奖的情况
  if (lotteryInfo.noParticipants) {
    return (
      <View className='winning-status-section'>
        <View className='winning-status-card neutral'>
          <Text className='status-title'>无人参与抽奖</Text>
          <Text className='status-message'>本次抽奖无人参与，无中奖者</Text>
        </View>
      </View>
    );
  }

  // 检查当前用户是否中奖
  const userOpenid = userInfo._openid;
  const isWinner = lotteryInfo.winners && lotteryInfo.winners.some(
    winner => winner._openid === userOpenid
  );

  if (isWinner) {
    // 用户中奖
    return (
      <View className='winning-status-section'>
        <View className='winning-status-card winner'>
          <View className='status-icon'>🎉</View>
          <Text className='status-title'>恭喜您中奖了!</Text>
          <Text className='status-message'>您是本次抽奖的幸运获奖者</Text>

          {/* 可以添加中奖凭证或分享按钮 */}
          <Button className='share-win-btn'>分享中奖喜悦</Button>
        </View>
      </View>
    );
  } else {
    // 用户未中奖
    return (
      <View className='winning-status-section'>
        <View className='winning-status-card loser'>
          <View className='status-icon'>😢</View>
          <Text className='status-title'>很遗憾，您未中奖</Text>
          <Text className='status-message'>感谢您的参与，下次再接再厉</Text>
          <View className='winners-count'>
            <Text>共 {lotteryInfo.winners ? lotteryInfo.winners.length : 0} 人中奖</Text>
          </View>
        </View>
      </View>
    );
  }
};

export default WinningStatus;