// src/pages/create/index.jsx - Simplified version with simpler time handling
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
import {
  formatTime,
  getFutureDateTime,
  combineDateTime,
  formatChineseTime
} from '../../utils/timeUtils';
import './index.scss';

const Create = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // Get current date and time
  const getCurrentDateTime = () => {
    const now = new Date();

    // Get date part: YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const date = `${year}-${month}-${day}`;

    // Get time part: HH:MM
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}`;

    return { date, time };
  };

  // Get current date and time
  const { date: currentDate, time: currentTime } = getCurrentDateTime();

  // Lottery form data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState(currentDate);
  const [endTime, setEndTime] = useState(currentTime);
  const [prizeCount, setPrizeCount] = useState('1');
  const [quickTimeOption, setQuickTimeOption] = useState('15min'); // Default to 15 minutes

  // Check login status
  useEffect(() => {
    const userInfoStored = Taro.getStorageSync('userInfo');
    if (userInfoStored) {
      setUserInfo(userInfoStored);
      console.log("User info retrieved:", userInfoStored);

      // Check admin permissions
      if (!userInfoStored.isAdmin) {
        Taro.showToast({
          title: 'You don\'t have creation permission',
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
        title: 'Please login first',
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

    // Set default end time to 15 minutes later
    handleQuickTimeSelect('15min');
  }, []);

  // Handle quick time selection
  const handleQuickTimeSelect = (option) => {
    setQuickTimeOption(option);

    // Set end time based on option
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
        // No action for custom time
        return;
      default:
        futureDateTime = getFutureDateTime(15);
    }

    setEndDate(futureDateTime.date);
    setEndTime(futureDateTime.time);
  };

  // Validate end time is greater than current time
  const isEndTimeValid = () => {
    const now = new Date();
    const endDateTime = new Date(`${endDate} ${endTime}`);
    return endDateTime > now;
  };

  // Go back to previous page
  const goBack = () => {
    Taro.navigateBack();
  };

  // Create lottery - Cloud function version
  const handleCreateLottery = async () => {
    // Form validation
    if (!title.trim()) {
      Taro.showToast({ title: 'Please enter a lottery title', icon: 'none' });
      return;
    }

    if (!endDate || !endTime) {
      Taro.showToast({ title: 'Please select draw time', icon: 'none' });
      return;
    }

    if (parseInt(prizeCount) < 1) {
      Taro.showToast({ title: 'Prize count must be at least 1', icon: 'none' });
      return;
    }

    // Validate end time is greater than current time
    const combinedEndDateTime = combineDateTime(endDate, endTime);
    if (new Date() >= new Date(combinedEndDateTime)) {
      Taro.showToast({ title: 'Draw time must be greater than current time', icon: 'none' });
      return;
    }

    // Double check user login status
    const storedUserInfo = Taro.getStorageSync('userInfo');
    if (!storedUserInfo) {
      Taro.showToast({
        title: 'Login status expired, please login again',
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
      Taro.showToast({ title: 'You don\'t have creation permission', icon: 'none' });
      return;
    }

    setLoading(true);
    Taro.showLoading({ title: 'Creating...' });

    try {
      console.log("Current logged-in user info:", storedUserInfo);

      // Get current time as start time
      const startDateTime = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-');

      console.log("Start time:", startDateTime);
      console.log("End time:", combinedEndDateTime);

      // Call cloud function to create lottery
      const lotteryData = {
        title,
        description: description || title,
        startTime: startDateTime,
        endTime: combinedEndDateTime,
        prizeCount: parseInt(prizeCount)
      };

      console.log("Preparing to create lottery, data:", lotteryData);

      const result = await createLottery(lotteryData);
      console.log("Lottery creation result:", result);

      if (result && result.success) {
        Taro.hideLoading();
        Taro.showToast({
          title: 'Creation successful',
          icon: 'success',
          duration: 2000,
          success: () => {
            // Navigate to lottery detail page
            setTimeout(() => {
              Taro.navigateTo({
                url: `/pages/detail/index?lotteryId=${result.data._id}`,
              });
            }, 2000);
          },
        });
      } else {
        Taro.hideLoading();
        Taro.showToast({
          title: result?.message || 'Creation failed',
          icon: 'none',
        });
      }
    } catch (error) {
      console.error('Failed to create lottery', error);
      Taro.hideLoading();
      Taro.showToast({
        title: 'Creation failed, please try again: ' + (error.message || ''),
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  // If not logged in or not an admin, show loading state
  if (!userInfo || !userInfo.isAdmin) {
    return (
      <View className='loading-container'>
        <Text className='loading-text'>Checking permissions...</Text>
      </View>
    );
  }

  // Calculate time difference from current time to draw time
  const calculateTimeDifference = () => {
    const now = new Date();
    const end = new Date(`${endDate} ${endTime}`);

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

  // Create lottery page
  return (
    <View className='create-lottery-container'>
      <View className='page-header'>
        <Text className='page-title'>创建抽奖</Text>
        <View className='back-btn' onClick={goBack}>
          <Text className='back-icon'>←</Text>
        </View>
      </View>

      <Form className='lottery-form'>
        {/* Basic Information */}
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
                setQuickTimeOption('custom'); // Switch to custom mode
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
                setQuickTimeOption('custom'); // Switch to custom mode
              }}
            >
              <View className='form-picker'>
                {endTime || '请选择开奖时间'}
              </View>
            </Picker>
          </View>

          {/* Draw time preview */}
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

        {/* Prize Settings */}
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

        {/* Create Button */}
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