// src/pages/index/index.jsx (完整修改版)
import React, { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Button, Image, ScrollView } from '@tarojs/components';
import {
  checkLoginStatus,
  getLotteryList,
  completeWxLogin,
} from '../../utils/api';
import './index.scss';

const Index = () => {
  // 状态管理
  const [lotteryList, setLotteryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loginModalVisible, setLoginModalVisible] = useState(false);

// src/pages/index/index.jsx 中的 useEffect 钩子修改
useEffect(() => {
  const params = Taro.getCurrentInstance().router.params;

  if (params && params.lotteryId) {
    // 如果有抽奖ID参数，直接跳转到抽奖详情页
    Taro.navigateTo({
      url: `/pages/detail/index?lotteryId=${params.lotteryId}`,
    });
  } else {
    // 否则加载抽奖列表和检查登录状态
    initializeApp();

    // 添加: 自动检测登录状态，未登录则弹窗
    const userInfo = Taro.getStorageSync('userInfo');
    if (!userInfo) {
      // 延迟一小段时间再显示登录弹窗，让页面先渲染完成
      setTimeout(() => {
        setLoginModalVisible(true);
      }, 500);
    }
  }
}, []);

  // 页面加载时检查是否有指定的抽奖ID和登录状态
  useEffect(() => {
    const params = Taro.getCurrentInstance().router.params;

    if (params && params.lotteryId) {
      // 如果有抽奖ID参数，直接跳转到抽奖详情页
      Taro.navigateTo({
        url: `/pages/detail/index?lotteryId=${params.lotteryId}`,
      });
    } else {
      // 否则加载抽奖列表和检查登录状态
      initializeApp();
    }
  }, []);

  // 初始化应用
  const initializeApp = async () => {
    try {
      // 检查登录状态
      const loginStatus = await checkLoginStatus();

      if (loginStatus.isLoggedIn) {
        setUserInfo(loginStatus.userInfo);
        setIsAdmin(loginStatus.userInfo.isAdmin || false);
      }

      // 无论是否登录，都获取抽奖列表
      fetchLotteryList();
    } catch (error) {
      console.error('初始化应用失败:', error);
      setLoading(false);
    }
  };

  // 处理微信登录 - 云函数版本
  const handleWxLogin = async () => {
    try {
      setLoading(true);

      // 获取用户信息 - 必须在用户点击事件中调用
      const { userInfo: wxUserInfo } = await Taro.getUserProfile({
        desc: '用于完善会员资料',
      });

      if (!wxUserInfo) {
        throw new Error('获取用户信息失败');
      }

      // 使用云函数完成登录
      const result = await completeWxLogin(wxUserInfo);

      setUserInfo(result.user);
      setIsAdmin(result.user.isAdmin || false);
      setLoginModalVisible(false);

      Taro.showToast({
        title: '登录成功',
        icon: 'success',
      });

      // 登录成功后刷新列表
      fetchLotteryList();
    } catch (error) {
      console.error('微信登录失败:', error);
      Taro.showToast({
        title: '登录失败，请重试',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取抽奖列表 - 云函数版本
  const fetchLotteryList = async (refresh = true) => {
    if (refresh) {
      setLoading(true);
      setPage(1);
    }

    try {
      const params = {
        page: refresh ? 1 : page,
        limit: 10,
      };

      const result = await getLotteryList(params);

      if (result.success) {
        if (refresh) {
          setLotteryList(result.data.lotteries);
        } else {
          setLotteryList([...lotteryList, ...result.data.lotteries]);
        }

        setHasMore(result.data.lotteries.length === 10);
        setPage(refresh ? 2 : page + 1);
      } else {
        Taro.showToast({
          title: result.message || '获取抽奖列表失败',
          icon: 'none',
        });
      }
    } catch (error) {
      console.error('获取抽奖列表失败', error);
      Taro.showToast({
        title: '获取抽奖列表失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  // 加载更多
  const loadMore = () => {
    if (hasMore && !loading) {
      fetchLotteryList(false);
    }
  };

  // 跳转到抽奖详情页
  const goToLotteryDetail = async (lotteryId) => {
    // 如果未登录，先登录
    if (!userInfo) {
      try {
        await handleWxLogin();
      } catch (error) {
        // 登录失败，显示登录弹窗
        setLoginModalVisible(true);
        return;
      }
    }

    Taro.navigateTo({
      url: `/pages/detail/index?lotteryId=${lotteryId}`,
    });
  };

  // 跳转到创建抽奖页面
  const goToCreateLottery = async () => {
    // 如果未登录，先登录
    if (!userInfo) {
      try {
        const user = await handleWxLogin();
        if (!user.isAdmin) {
          Taro.showToast({
            title: '您没有创建权限',
            icon: 'none'
          });
          return;
        }
      } catch (error) {
        // 登录失败，显示登录弹窗
        setLoginModalVisible(true);
        return;
      }
    } else if (!userInfo.isAdmin) {
      Taro.showToast({
        title: '您没有创建权限',
        icon: 'none'
      });
      return;
    }

    Taro.navigateTo({
      url: '/pages/create/index',
    });
  };

  // 下拉刷新
  const onPullDownRefresh = () => {
    fetchLotteryList();
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  };

  // 处理头像加载错误
  const handleImageError = (e) => {
    e.target.src = 'https://mmbiz.qlogo.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
  };

  // 渲染加载状态
  if (loading && lotteryList.length === 0) {
    return (
      <View className='loading-container'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    );
  }

  return (
    <View className='lottery-list-page'>
      {/* 页面头部 */}
      <View className='page-header'>
        <Text className='page-title'>幸运抽奖</Text>

        <View className='header-actions'>
          {userInfo ? (
            <View className='user-info'>
              <Image
                className='user-avatar'
                src={userInfo.avatarUrl || 'https://mmbiz.qlogo.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'}
                onError={handleImageError}
              />
              <Text className='user-name'>
                {userInfo.nickName || '微信用户'}
              </Text>
            </View>
          ) : (
            <Button
              className='login-btn'
              size='mini'
              onClick={() => setLoginModalVisible(true)}
            >
              登录
            </Button>
          )}

          {isAdmin && (
            <Button className='create-btn' onClick={goToCreateLottery}>
              创建抽奖
            </Button>
          )}
        </View>
      </View>

      {/* 抽奖列表 */}
      <ScrollView
        className='lottery-list'
        scrollY
        enablePullDownRefresh
        onPullDownRefresh={onPullDownRefresh}
        onScrollToLower={loadMore}
      >
        {lotteryList.length > 0 ? (
          lotteryList.map((lottery) => (
            <View
              key={lottery._id} // 云开发中使用 _id 作为主键
              className='lottery-card'
              onClick={() => goToLotteryDetail(lottery._id)}
            >
              <View className='lottery-header'>
                <Text className='lottery-title'>{lottery.title}</Text>
                <View className='lottery-status'>
                  {lottery.status === 0 ? (
                    <Text className='status-tag ongoing'>进行中</Text>
                  ) : (
                    <Text className='status-tag ended'>已结束</Text>
                  )}
                </View>
              </View>

              <View className='lottery-info'>
                <View className='sponsor-info'>
                  <Image
                    className='sponsor-avatar'
                    src={lottery.creator?.avatarUrl || 'https://mmbiz.qlogo.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'}
                    onError={handleImageError}
                  />
                  <Text className='sponsor-name'>
                    {lottery.creator?.nickName || '管理员'}
                    {lottery.creator?.isAdmin && <Text className='admin-badge'>管理员</Text>}
                  </Text>
                </View>

                <View className='lottery-stats'>
                  <View className='stat-item'>
                    <Text className='stat-label'>奖品</Text>
                    <Text className='stat-value'>{lottery.prizeCount}个</Text>
                  </View>

                  <View className='stat-item'>
                    <Text className='stat-label'>开奖</Text>
                    <Text className='stat-value'>
                      {new Date(lottery.endTime).toLocaleDateString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).replace(/\//g, '/')}
                    </Text>
                  </View>
                </View>
              </View>

              <View className='lottery-footer'>
                <Text className='join-text'>点击参与</Text>
                <Text className='arrow-icon'>→</Text>
              </View>
            </View>
          ))
        ) : (
          <View className='empty-container'>
            <Text className='empty-text'>还没有抽奖活动</Text>
            {isAdmin && (
              <Button className='empty-create-btn' onClick={goToCreateLottery}>
                创建第一个抽奖
              </Button>
            )}
          </View>
        )}

        {/* 加载更多提示 */}
        {loading && lotteryList.length > 0 && (
          <View className='loading-more'>
            <Text>加载更多...</Text>
          </View>
        )}

        {!hasMore && lotteryList.length > 0 && (
          <View className='no-more'>
            <Text>没有更多了</Text>
          </View>
        )}
      </ScrollView>

      {/* 登录弹窗 */}
      {loginModalVisible && (
        <View className='login-modal'>
          <View
            className='login-modal-mask'
            onClick={() => setLoginModalVisible(false)}
          ></View>
          <View className='login-modal-content'>
            <View className='login-modal-header'>
              <Text className='login-modal-title'>微信授权登录</Text>
            </View>
            <View className='login-modal-body'>
              <Text className='login-modal-desc'>授权后可参与抽奖活动</Text>
              <Button
                className='wx-login-btn'
                loading={loading}
                onClick={handleWxLogin}
              >
                微信授权登录
              </Button>
              <Button
                className='cancel-btn'
                onClick={() => setLoginModalVisible(false)}
              >
                取消
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default Index;