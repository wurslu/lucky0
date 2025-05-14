// 修改版 - 自动设置开始时间为当前时间的 Create 组件

import React, { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import {
  View,
  Text,
  Button,
  Input,
  Picker,
  Form,
  Textarea,
} from '@tarojs/components';
import { createLottery } from '../../utils/api';
import './index.scss';

const Create = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // 获取当前时间作为默认值
  const getCurrentDateTime = () => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}`;
    return { date, time };
  };

  // 计算未来时间
  const getFutureDateTime = (minutesToAdd) => {
    const futureTime = new Date(Date.now() + minutesToAdd * 60000);
    const date = futureTime.toISOString().split('T')[0];
    const hours = String(futureTime.getHours()).padStart(2, '0');
    const minutes = String(futureTime.getMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}`;
    return { date, time };
  };

  // 获取当前时间
  const { date: currentDate, time: currentTime } = getCurrentDateTime();

  // 抽奖表单数据
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState(currentDate);
  const [endTime, setEndTime] = useState(currentTime);
  const [prizeCount, setPrizeCount] = useState('1');
  const [quickTimeOption, setQuickTimeOption] = useState('15min'); // 默认选择15分钟

  // 检查登录状态
  useEffect(() => {
    const userInfoStored = Taro.getStorageSync('userInfo');
    if (userInfoStored) {
      setUserInfo(userInfoStored);
      console.log("已获取到用户信息:", userInfoStored);

      // 云开发版本检查管理员权限
      if (!userInfoStored.isAdmin) {
        Taro.showToast({
          title: '您没有创建权限',
          icon: 'none',
          complete: () => {
            setTimeout(() => {
              Taro.navigateBack();
            }, 1500);
          },
        });
      }
    } else {
      Taro.showToast({
        title: '请先登录',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            Taro.redirectTo({
              url: '/pages/index/index',
            });
          }, 1500);
        },
      });
    }

    // 设置默认结束时间为15分钟后
    handleQuickTimeSelect('15min');
  }, []);

  // 处理快速时间选择
  const handleQuickTimeSelect = (option) => {
    setQuickTimeOption(option);

    // 根据选项设置结束时间
    let futureDateTime;
    switch (option) {
      case '15min':
        futureDateTime = getFutureDateTime(15);
        break;
      case '30min':
        futureDateTime = getFutureDateTime(30);
        break;
      case '1hour':
        futureDateTime = getFutureDateTime(60);
        break;
      case '3hour':
        futureDateTime = getFutureDateTime(180);
        break;
      case '1day':
        futureDateTime = getFutureDateTime(1440);
        break;
      case 'custom':
        // 自定义时间不做处理
        return;
      default:
        futureDateTime = getFutureDateTime(15);
    }

    setEndDate(futureDateTime.date);
    setEndTime(futureDateTime.time);
  };

  // 验证开奖时间是否大于当前时间
  const isEndTimeValid = () => {
    const now = new Date();
    const endDateTime = new Date(`${endDate}T${endTime}:00`);
    return endDateTime > now;
  };

  // 返回上一页
  const goBack = () => {
    Taro.navigateBack();
  };

  // 创建抽奖 - 云函数版本
  const handleCreateLottery = async () => {
    // 表单验证
    if (!title.trim()) {
      Taro.showToast({ title: '请输入抽奖标题', icon: 'none' });
      return;
    }

    if (!endDate || !endTime) {
      Taro.showToast({ title: '请选择开奖时间', icon: 'none' });
      return;
    }

    if (parseInt(prizeCount) < 1) {
      Taro.showToast({ title: '奖品数量至少为1', icon: 'none' });
      return;
    }

    // 验证开奖时间必须大于当前时间
    if (!isEndTimeValid()) {
      Taro.showToast({ title: '开奖时间必须大于当前时间', icon: 'none' });
      return;
    }

    // 再次检查用户登录状态
    const storedUserInfo = Taro.getStorageSync('userInfo');
    if (!storedUserInfo) {
      Taro.showToast({
        title: '登录状态已失效，请重新登录',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            Taro.redirectTo({ url: '/pages/index/index' });
          }, 1500);
        }
      });
      return;
    }

    if (!storedUserInfo.isAdmin) {
      Taro.showToast({ title: '您没有创建权限', icon: 'none' });
      return;
    }

    setLoading(true);
    Taro.showLoading({ title: '创建中...' });

    try {
      console.log("当前登录用户信息:", storedUserInfo);

      // 获取当前最新时间作为开始时间
      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      const startHours = String(now.getHours()).padStart(2, '0');
      const startMinutes = String(now.getMinutes()).padStart(2, '0');
      const startSeconds = String(now.getSeconds()).padStart(2, '0');
      const startTime = `${startHours}:${startMinutes}:${startSeconds}`;

      // 整合开始和结束时间
      const startDateTime = `${startDate}T${startTime}`;
      const endDateTime = `${endDate}T${endTime}:00`;

      // 调用云函数创建抽奖
      const lotteryData = {
        title,
        description: description || title,
        startTime: startDateTime,
        endTime: endDateTime,
        prizeCount: parseInt(prizeCount),
        status: 0  // 0表示进行中
      };

      console.log("准备创建抽奖，数据:", lotteryData);

      const result = await createLottery(lotteryData);
      console.log("创建抽奖结果:", result);

      if (result && result.success) {
        Taro.hideLoading();
        Taro.showToast({
          title: '创建成功',
          icon: 'success',
          duration: 2000,
          success: () => {
            // 跳转到抽奖详情页
            setTimeout(() => {
              Taro.navigateTo({
                url: `/pages/detail/index?lotteryId=${result.data._id}`, // 云开发使用_id
              });
            }, 2000);
          },
        });
      } else {
        Taro.hideLoading();
        Taro.showToast({
          title: result?.message || '创建失败',
          icon: 'none',
        });
      }
    } catch (error) {
      console.error('创建抽奖失败', error);
      Taro.hideLoading();
      Taro.showToast({
        title: '创建失败，请重试: ' + (error.message || ''),
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  // 如果未登录或非管理员，显示加载状态
  if (!userInfo || !userInfo.isAdmin) {
    return (
      <View className='loading-container'>
        <Text className='loading-text'>检查权限中...</Text>
      </View>
    );
  }

  // 计算当前时间到开奖时间的差值
  const calculateTimeDifference = () => {
    const now = new Date();
    const end = new Date(`${endDate}T${endTime}:00`);

    const diffMs = end - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let result = '';
    if (diffDays > 0) result += `${diffDays}天 `;
    if (diffHrs > 0 || diffDays > 0) result += `${diffHrs}小时 `;
    result += `${diffMins}分钟`;

    return result;
  };

  // 创建抽奖页面
  return (
    <View className='create-lottery-container'>
      <View className='page-header'>
        <Text className='page-title'>创建抽奖</Text>
        <View className='back-btn' onClick={goBack}>
          <Text className='back-icon'>←</Text>
        </View>
      </View>

      <Form className='lottery-form'>
        {/* 基本信息 */}
        <View className='form-section'>
          <Text className='section-title'>基本信息</Text>

          <View className='form-item'>
            <Text className='form-label'>抽奖标题</Text>
            <Input
              className='form-input'
              placeholder='请输入抽奖活动标题'
              value={title}
              onInput={(e) => setTitle(e.detail.value)}
              maxlength={30}
            />
          </View>

          <View className='form-item'>
            <Text className='form-label'>活动描述</Text>
            <Textarea
              className='form-textarea'
              placeholder='请输入活动描述（可选）'
              value={description}
              onInput={(e) => setDescription(e.detail.value)}
              maxlength={200}
            />
          </View>

          <View className='form-item'>
            <Text className='form-label'>开始时间</Text>
            <View className='start-time-info'>
              <Text className='start-time-text'>抽奖将从创建成功后立即开始</Text>
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>开奖时间设置</Text>
            <View className='quick-time-options'>
              <View
                className={`quick-time-option ${quickTimeOption === '15min' ? 'active' : ''}`}
                onClick={() => handleQuickTimeSelect('15min')}
              >
                15分钟
              </View>
              <View
                className={`quick-time-option ${quickTimeOption === '30min' ? 'active' : ''}`}
                onClick={() => handleQuickTimeSelect('30min')}
              >
                30分钟
              </View>
              <View
                className={`quick-time-option ${quickTimeOption === '1hour' ? 'active' : ''}`}
                onClick={() => handleQuickTimeSelect('1hour')}
              >
                1小时
              </View>
              <View
                className={`quick-time-option ${quickTimeOption === '3hour' ? 'active' : ''}`}
                onClick={() => handleQuickTimeSelect('3hour')}
              >
                3小时
              </View>
              <View
                className={`quick-time-option ${quickTimeOption === '1day' ? 'active' : ''}`}
                onClick={() => handleQuickTimeSelect('1day')}
              >
                1天
              </View>
              <View
                className={`quick-time-option ${quickTimeOption === 'custom' ? 'active' : ''}`}
                onClick={() => setQuickTimeOption('custom')}
              >
                自定义
              </View>
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>开奖日期</Text>
            <Picker
              mode='date'
              value={endDate}
              start={currentDate}
              onChange={(e) => {
                setEndDate(e.detail.value);
                setQuickTimeOption('custom'); // 切换到自定义模式
              }}
            >
              <View className='form-picker'>
                {endDate || '请选择开奖日期'}
              </View>
            </Picker>
          </View>

          <View className='form-item'>
            <Text className='form-label'>开奖时间</Text>
            <Picker
              mode='time'
              value={endTime}
              onChange={(e) => {
                setEndTime(e.detail.value);
                setQuickTimeOption('custom'); // 切换到自定义模式
              }}
            >
              <View className='form-picker'>
                {endTime || '请选择开奖时间'}
              </View>
            </Picker>
          </View>

          {/* 开奖时间提示 */}
          {endDate && endTime && (
            <View className='time-preview'>
              <Text className='time-preview-label'>开奖倒计时预览：</Text>
              <Text className='time-preview-value'>
                {isEndTimeValid()
                  ? `${calculateTimeDifference()}`
                  : '开奖时间必须大于当前时间'}
              </Text>
            </View>
          )}
        </View>

        {/* 奖品设置 */}
        <View className='form-section'>
          <Text className='section-title'>奖品设置</Text>

          <View className='form-item'>
            <Text className='form-label'>奖品数量</Text>
            <View className='prize-count-container'>
              <Input
                className='form-input prize-count-input'
                type='number'
                placeholder='请输入奖品数量'
                value={prizeCount}
                onInput={(e) => setPrizeCount(e.detail.value)}
                maxlength={3}
              />
              <View className='prize-count-controls'>
                <View
                  className='prize-count-btn'
                  onClick={() => setPrizeCount(Math.max(1, parseInt(prizeCount || 1) - 1).toString())}
                >-</View>
                <View
                  className='prize-count-btn'
                  onClick={() => setPrizeCount((parseInt(prizeCount || 0) + 1).toString())}
                >+</View>
              </View>
            </View>
          </View>

          <View className='prize-quick-select'>
            <View className='prize-quick-option' onClick={() => setPrizeCount('1')}>1</View>
            <View className='prize-quick-option' onClick={() => setPrizeCount('3')}>3</View>
            <View className='prize-quick-option' onClick={() => setPrizeCount('5')}>5</View>
            <View className='prize-quick-option' onClick={() => setPrizeCount('10')}>10</View>
          </View>
        </View>

        {/* 创建按钮 */}
        <Button
          className={`create-btn ${loading ? 'button-loading' : ''}`}
          loading={loading}
          disabled={loading}
          onClick={handleCreateLottery}
        >
          创建抽奖
        </Button>
      </Form>
    </View>
  );
};

export default Create;