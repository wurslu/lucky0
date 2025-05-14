// client/src/pages/detail/components/RulesSection.jsx
import React from 'react';
import { View, Text } from '@tarojs/components';

/**
 * 活动规则区域组件
 */
const RulesSection = ({ lotteryInfo, formatChineseTime }) => {
  if (!lotteryInfo) return null;

  return (
    <View className='rules-section'>
      <Text className='section-title'>活动规则</Text>
      <Text className='rule-item'>1. 每人只能参与一次抽奖</Text>
      <Text className='rule-item'>
        2. 系统将于{' '}
        {formatChineseTime(lotteryInfo.endTimeLocal || lotteryInfo.endTime)}{' '}
        自动开奖
      </Text>
      <Text className='rule-item'>3. 中奖者将显示在中奖名单中</Text>
      <Text className='rule-item'>
        4. 本活动最终解释权归{' '}
        {lotteryInfo.creator?.nickName || '管理员'}{' '}
        所有
      </Text>
    </View>
  );
};

export default RulesSection;