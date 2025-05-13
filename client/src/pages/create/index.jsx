// src/pages/create/index.jsx (完整修改版)
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

  // 抽奖表单数据
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [prizeCount, setPrizeCount] = useState('1');

  // 检查登录状态
  useEffect(() => {
    const userInfoStored = Taro.getStorageSync('userInfo');
    if (userInfoStored) {
      setUserInfo(userInfoStored);

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
  }, []);

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

    setLoading(true);
    Taro.showLoading({ title: '创建中...' });

    try {
      // 整合开始和结束时间
      const startDateTime = `${startDate}T${startTime}:00`;
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

      const result = await createLottery(lotteryData);

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
        title: '创建失败，请重试',
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
            <Text className='form-label'>开始日期</Text>
            <Picker
              mode='date'
              value={startDate}
              start={new Date().toISOString().split('T')[0]}
              onChange={(e) => setStartDate(e.detail.value)}
            >
              <View
                className={`form-picker ${!startDate ? 'placeholder' : ''}`}
              >
                {startDate || '请选择开始日期'}
              </View>
            </Picker>
          </View>

          <View className='form-item'>
            <Text className='form-label'>开始时间</Text>
            <Picker
              mode='time'
              value={startTime}
              onChange={(e) => setStartTime(e.detail.value)}
            >
              <View
                className={`form-picker ${!startTime ? 'placeholder' : ''}`}
              >
                {startTime || '请选择开始时间'}
              </View>
            </Picker>
          </View>

          <View className='form-item'>
            <Text className='form-label'>开奖日期</Text>
            <Picker
              mode='date'
              value={endDate}
              start={startDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => setEndDate(e.detail.value)}
            >
              <View className={`form-picker ${!endDate ? 'placeholder' : ''}`}>
                {endDate || '请选择开奖日期'}
              </View>
            </Picker>
          </View>

          <View className='form-item'>
            <Text className='form-label'>开奖时间</Text>
            <Picker
              mode='time'
              value={endTime}
              onChange={(e) => setEndTime(e.detail.value)}
            >
              <View className={`form-picker ${!endTime ? 'placeholder' : ''}`}>
                {endTime || '请选择开奖时间'}
              </View>
            </Picker>
          </View>
        </View>

        {/* 奖品设置 */}
        <View className='form-section'>
          <Text className='section-title'>奖品设置</Text>

          <View className='form-item'>
            <Text className='form-label'>奖品数量</Text>
            <Input
              className='form-input'
              type='number'
              placeholder='请输入奖品数量'
              value={prizeCount}
              onInput={(e) => setPrizeCount(e.detail.value)}
              maxlength={3}
            />
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