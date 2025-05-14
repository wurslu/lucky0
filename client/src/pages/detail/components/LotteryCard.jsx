// client/src/pages/detail/components/LotteryCard.jsx
import React from 'react';
import { View, Text, Image } from '@tarojs/components';

/**
 * 抽奖信息卡片组件
 */
const LotteryCard = ({
  lotteryInfo,
  isActive,
  countdown,
  formatShortChineseTime,
  handleImageError
}) => {
  if (!lotteryInfo) return null;

  return (
    <View className='lottery-card'>
      <View className='lottery-header'>
        <Text className='lottery-title'>{lotteryInfo.title}</Text>
        <View className='lottery-status-tag'>
          {isActive ? (
            <Text className='status-tag ongoing'>进行中</Text>
          ) : (
            <Text className='status-tag ended'>已结束</Text>
          )}
        </View>
        <View className='sponsor-info'>
          <Image
            className='sponsor-avatar'
            src={
              lotteryInfo.creator?.avatarUrl || 'https://mmbiz.qlogo.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
            }
            onError={handleImageError}
          />
          <Text className='sponsor-name'>
            主办方:{' '}
            {lotteryInfo.creator?.nickName || '管理员'}
            {lotteryInfo.creator?.isAdmin && <Text className='admin-badge'>管理员</Text>}
          </Text>
        </View>
      </View>

      <View className='lottery-content'>
        <View className='prize-info'>
          <Text className='section-title'>奖品设置</Text>
          <View className='prize-item'>
            <Text className='prize-value'>
              共 {lotteryInfo.prizeCount} 份奖品
            </Text>
            <Text className='prize-desc'>
              {lotteryInfo.description || '无描述'}
            </Text>
          </View>
        </View>

        <View className='lottery-status'>
          <View className='status-item'>
            <Text className='status-label'>参与人数</Text>
            <Text className='status-value'>
              {lotteryInfo.participants ? lotteryInfo.participants.length : 0}
            </Text>
          </View>

          <View className='status-item'>
            <Text className='status-label'>
              {isActive ? '开奖倒计时' : '开奖时间'}
            </Text>
            <Text className='status-value countdown'>
              {isActive
                ? countdown
                : formatShortChineseTime(lotteryInfo.endTimeLocal || lotteryInfo.endTime)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default LotteryCard;