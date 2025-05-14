// client/src/pages/detail/components/ActionButtons.jsx
import React from 'react';
import { View, Text, Button } from '@tarojs/components';

/**
 * 抽奖操作按钮组件
 */
const ActionButtons = ({
  isActive,
  joined,
  isCreator,
  isAdmin,
  userInfo,
  formatShortChineseTime,
  lotteryInfo,
  handleJoinLottery,
  handleDrawLottery,
  handleShare
}) => {
  if (!lotteryInfo) return null;

  // 参与按钮区域
  const renderParticipateArea = () => {
    if (!isActive) return null;

    return (
      <View className='action-area'>
        {joined ? (
          <View className='joined-info'>
            <Text className='joined-text'>已成功参与抽奖</Text>
            <Text className='joined-tips'>
              开奖结果将在{' '}
              {formatShortChineseTime(lotteryInfo.endTimeLocal || lotteryInfo.endTime)}{' '}
              公布
            </Text>
            <Button className='share-btn' onClick={handleShare}>
              邀请好友参与
            </Button>
          </View>
        ) : (
          <Button className='join-btn' onClick={handleJoinLottery}>
            {userInfo ? '参与抽奖' : '微信登录并参与'}
          </Button>
        )}
      </View>
    );
  };

  // 管理员手动开奖按钮
  const renderAdminActions = () => {
    if (!isActive || (!isCreator && !isAdmin)) return null;

    return (
      <View className='admin-actions'>
        <Button className='draw-btn' onClick={handleDrawLottery}>
          手动开奖
        </Button>
      </View>
    );
  };

  return (
    <>
      {renderParticipateArea()}
      {renderAdminActions()}
    </>
  );
};

export default ActionButtons;