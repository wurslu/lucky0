// client/src/pages/detail/components/TestButtons.jsx - 修复导入语句
import React from 'react';
import { View, Button } from '@tarojs/components';
import { debugLottery, testAutoDrawLottery, testCurrentLotteryDraw } from '../testUtils';

/**
 * 测试操作按钮组件 - 仅开发环境使用
 */
const TestButtons = ({
  isAdmin,
  lotteryId,
  testUtils,
  handleManualRefresh
}) => {
  // 根据环境变量判断是否显示测试按钮
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev) return null;

  return (
    <View className='test-buttons'>
      {/* 调试按钮 */}
      <Button
        size='mini'
        type='default'
        style={{position: 'absolute', top: '20px', right: '20px', fontSize: '10px', padding: '0 8px'}}
        onClick={() => testUtils.debugLottery(debugLottery)}
      >
        调试
      </Button>

      {/* 测试自动开奖按钮 */}
      {isAdmin && (
        <Button
          size='mini'
          type='primary'
          style={{position: 'absolute', top: '20px', right: '230px', fontSize: '10px', padding: '0 8px'}}
          onClick={() => testUtils.testAutoDrawLottery(testAutoDrawLottery)}
        >
          测试自动开奖
        </Button>
      )}

      {/* 测试当前抽奖开奖按钮 */}
      <Button
        size='mini'
        type='primary'
        style={{position: 'absolute', top: '20px', right: '120px', fontSize: '10px', padding: '0 8px'}}
        onClick={() => testUtils.testCurrentLotteryDraw(testCurrentLotteryDraw)}
      >
        测试本抽奖
      </Button>

      {/* 刷新按钮 */}
      <Button
        size='mini'
        type='default'
        style={{position: 'absolute', top: '20px', right: '70px', fontSize: '10px', padding: '0 8px'}}
        onClick={handleManualRefresh}
      >
        刷新
      </Button>
    </View>
  );
};

export default TestButtons;