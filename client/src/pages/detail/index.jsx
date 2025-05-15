// client/src/pages/detail/index.jsx - 重构版
import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import { useDetail } from './hooks/useDetail';
import { renderWinners } from './renderUtils';
import LotteryCard from './components/LotteryCard';
import ActionButtons from './components/ActionButtons';
import RulesSection from './components/RulesSection';
import TestButtons from './components/TestButtons';
import WinningStatus from './components/WinningStatus';
import './index.scss';

const Detail = () => {
  // 使用钩子获取所有状态和方法
  const detail = useDetail();

  const {
    loading,
    lotteryInfo,
    isActive,
    lotteryId,
    userInfo,
    joined,
    isCreator,
    isAdmin,
    countdown,
    isLotteryEnded,
    handleJoinLottery,
    handleDrawLottery,
    handleShare,
    goBack,
    handleImageError,
    handleManualRefresh,
    testUtils,
    formatChineseTime,
    formatShortChineseTime
  } = detail;

  // 渲染加载状态
  if (loading) {
    return (
      <View className='loading-container'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    );
  }

  // 渲染错误状态
  if (!lotteryInfo) {
    return (
      <View className='error-container'>
        <Text className='error-text'>无法加载抽奖信息</Text>
        <Button className='back-btn' onClick={goBack}>
          返回首页
        </Button>
      </View>
    );
  }

  return (
    <View className='lottery-detail-page'>
      {/* 页面头部 */}
      <View className='page-header'>
        <View className='back-btn' onClick={goBack}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='page-title'>抽奖详情</Text>
        <View className='placeholder'></View>
      </View>

      {/* 测试按钮组 - 开发环境使用 */}
      <TestButtons
        isAdmin={isAdmin}
        lotteryId={lotteryId}
        testUtils={testUtils}
        handleManualRefresh={handleManualRefresh}
      />

      {/* 抽奖信息卡片 */}
      <LotteryCard
        lotteryInfo={lotteryInfo}
        isActive={isActive}
        countdown={countdown}
        formatShortChineseTime={formatShortChineseTime}
        handleImageError={handleImageError}
      />

{/* 中奖状态提示组件 - 明确显示用户是否中奖 */}
{lotteryInfo.hasDrawn && (
        <WinningStatus
          lotteryInfo={lotteryInfo}
          userInfo={userInfo}
          handleManualRefresh={handleManualRefresh}
          handleImageError={handleImageError}
        />
      )}

      {/* 中奖结果（如果抽奖已结束） */}
      {renderWinners(lotteryInfo, isLotteryEnded, handleImageError, handleManualRefresh)}

      {/* 操作按钮组 */}
      <ActionButtons
        isActive={isActive}
        joined={joined}
        isCreator={isCreator}
        isAdmin={isAdmin}
        userInfo={userInfo}
        formatShortChineseTime={formatShortChineseTime}
        lotteryInfo={lotteryInfo}
        handleJoinLottery={handleJoinLottery}
        handleDrawLottery={handleDrawLottery}
        handleShare={handleShare}
      />

      {/* 活动规则 */}
      <RulesSection
        lotteryInfo={lotteryInfo}
        formatChineseTime={formatChineseTime}
      />
    </View>
  );
};

export default Detail;