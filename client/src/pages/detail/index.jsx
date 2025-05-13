// src/pages/detail/index.jsx (完整版含时区修复)
import React, { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Button, Image } from '@tarojs/components';
import {
  getLotteryDetail,
  joinLottery,
  drawLottery,
  completeWxLogin,
} from '../../utils/api';
import './index.scss';

const Detail = () => {
  // 获取路由参数
  const [lotteryId, setLotteryId] = useState('');

  // 状态管理
  const [userInfo, setUserInfo] = useState(null);
  const [joined, setJoined] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [lotteryInfo, setLotteryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('00:00:00');
  const [countdownTimer, setCountdownTimer] = useState(null);

  useEffect(() => {
    const params = Taro.getCurrentInstance().router.params;
    console.log("获取到路由参数:", params);

    if (params && params.lotteryId) {
      console.log("获取到抽奖ID:", params.lotteryId);
      setLotteryId(params.lotteryId);

      // 从本地获取用户信息
      const userInfoStored = Taro.getStorageSync('userInfo');
      if (userInfoStored) {
        setUserInfo(userInfoStored);
      }

      // 获取抽奖详情
      fetchLotteryDetail(params.lotteryId);
    } else {
      console.error("未获取到抽奖ID");
      Taro.showToast({
        title: '未找到抽奖信息',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            Taro.navigateBack();
          }, 1500);
        },
      });
    }

    // 组件卸载时清除定时器
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    };
  }, []);


  // 获取抽奖详情 - 云函数版本
  const fetchLotteryDetail = async (id) => {
    setLoading(true);
    console.log("开始获取抽奖详情，ID:", id || lotteryId);

    if (!id && !lotteryId) {
      console.error("抽奖ID为空，无法获取详情");
      Taro.showToast({
        title: '抽奖ID不能为空',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            Taro.navigateBack();
          }, 1500);
        },
      });
      setLoading(false);
      return;
    }

    try {
      const result = await getLotteryDetail(id || lotteryId);

      if (result && result.success) {
        console.log('抽奖详情数据:', result.data);
        setLotteryInfo(result.data);

        // 检查当前用户是否是创建者
        if (userInfo && (
            result.data.creatorId === userInfo._openid ||
            result.data.creatorId === userInfo.openid
          )) {
          setIsCreator(true);
        }

        // 检查当前用户是否已参与
        if (userInfo && result.data.participants) {
          const hasJoined = result.data.participants.some(
            (p) => p.openid === userInfo._openid || p.openid === userInfo.openid
          );
          setJoined(hasJoined);
        }

        // 设置倒计时
        startCountdown(result.data.endTimeLocal || result.data.endTime);
      } else {
        console.error("获取抽奖详情失败:", result?.message);
        Taro.showToast({
          title: result?.message || '获取抽奖详情失败',
          icon: 'none',
          complete: () => {
            setTimeout(() => {
              Taro.navigateBack();
            }, 1500);
          },
        });
      }
    } catch (error) {
      console.error('获取抽奖详情失败', error);
      Taro.showToast({
        title: '获取抽奖详情失败',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            Taro.navigateBack();
          }, 1500);
        },
      });
    } finally {
      setLoading(false);
    }
  };

  // 开始倒计时
  const startCountdown = (endTimeStr) => {
    // 清除可能存在的之前的定时器
    if (countdownTimer) {
      clearInterval(countdownTimer);
    }

    try {
      // 首先验证结束时间是否有效
      const endTime = new Date(endTimeStr);
      const now = new Date();

      console.log('开始倒计时，当前时间:', now.toISOString());
      console.log('目标时间:', endTime.toISOString());
      console.log('时区偏移(分钟):', endTime.getTimezoneOffset());

      // 检查日期是否有效
      if (isNaN(endTime.getTime())) {
        console.error('无效的结束时间:', endTimeStr);
        setCountdown('无效的时间');
        return;
      }

      // 如果结束时间已过，直接显示 00:00:00 并刷新抽奖信息
      if (now >= endTime) {
        console.log('结束时间已过，显示零时间');
        setCountdown('00:00:00');

        // 刷新抽奖信息，获取最新状态
        setTimeout(() => {
          fetchLotteryDetail();
        }, 1000);

        return;
      }

      // 计算并设置初始倒计时
      setCountdown(getCountdown(endTimeStr));

      // 设置新的定时器 - 每秒更新一次
      const timer = setInterval(() => {
        const countdown = getCountdown(endTimeStr);
        setCountdown(countdown);

        // 如果倒计时结束，清除定时器并刷新数据
        if (countdown === '00:00:00') {
          clearInterval(timer);
          console.log('倒计时结束，刷新数据');

          // 刷新抽奖信息，获取最新状态
          setTimeout(() => {
            fetchLotteryDetail();
          }, 1000);
        }
      }, 1000);

      setCountdownTimer(timer);
    } catch (error) {
      console.error('启动倒计时出错:', error);
      setCountdown('计时错误');
    }
  };

  // 处理微信登录并参与抽奖 - 云函数版本
  const handleLoginAndJoin = async () => {
    try {
      Taro.showLoading({ title: '登录中...' });

      // 1. 获取用户信息
      const { userInfo: wxUserInfo } = await Taro.getUserProfile({
        desc: '用于完善会员资料',
      });

      // 2. 使用云函数完成登录
      const result = await completeWxLogin(wxUserInfo);

      // 更新本地状态
      setUserInfo(result.user);

      Taro.hideLoading();
      Taro.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1000
      });

      // 登录成功后自动参与抽奖
      setTimeout(() => {
        handleJoinLottery();
      }, 1000);
    } catch (error) {
      console.error('微信登录失败:', error);
      Taro.hideLoading();
      Taro.showToast({
        title: '登录失败，请重试',
        icon: 'none',
      });
    }
  };

  // 参与抽奖
  const handleJoinLottery = async () => {
    if (!userInfo) {
      // 未登录情况下，先进行登录
      handleLoginAndJoin();
      return;
    }

    Taro.showLoading({ title: '参与中...' });

    try {
      const result = await joinLottery(lotteryId);

      if (result && result.success) {
        setJoined(true);

        Taro.hideLoading();
        Taro.showToast({
          title: '参与成功',
          icon: 'success',
        });

        // 刷新抽奖详情
        setTimeout(() => {
          fetchLotteryDetail();
        }, 1000);
      } else {
        Taro.hideLoading();
        Taro.showToast({
          title: result?.message || '参与失败',
          icon: 'none',
        });
      }
    } catch (error) {
      console.error('参与抽奖失败', error);
      Taro.hideLoading();
      Taro.showToast({
        title: '参与失败，请重试',
        icon: 'none',
      });
    }
  };

  // 手动开奖（仅管理员可用）
  const handleDrawLottery = async () => {
    if (!isCreator && !userInfo?.isAdmin) {
      Taro.showToast({
        title: '无权操作',
        icon: 'none',
      });
      return;
    }

    // 确认是否开奖
    Taro.showModal({
      title: '手动开奖',
      content: '确定要立即开奖吗？开奖后无法撤销。',
      success: async (res) => {
        if (res.confirm) {
          Taro.showLoading({ title: '开奖中...' });

          try {
            const result = await drawLottery(lotteryId);

            if (result && result.success) {
              Taro.hideLoading();
              Taro.showToast({
                title: '开奖成功',
                icon: 'success',
              });

              // 刷新抽奖信息
              setTimeout(() => {
                fetchLotteryDetail();
              }, 1000);
            } else {
              Taro.hideLoading();
              Taro.showToast({
                title: result?.message || '开奖失败',
                icon: 'none',
              });
            }
          } catch (error) {
            console.error('开奖失败', error);
            Taro.hideLoading();
            Taro.showToast({
              title: '开奖失败，请重试',
              icon: 'none',
            });
          }
        }
      },
    });
  };

  // 分享给好友
  const handleShare = () => {
    // 由于不能在代码中直接触发分享，这里只是提示用户
    Taro.showToast({
      title: '点击右上角分享给好友',
      icon: 'none',
    });
  };

  // 计算倒计时
  const getCountdown = (endTimeStr) => {
    if (!endTimeStr) return '00:00:00';

    try {
      const endTime = new Date(endTimeStr).getTime();
      const now = new Date().getTime();
      const diff = endTime - now;

      console.log('计算倒计时:');
      console.log('当前时间:', new Date(now).toISOString());
      console.log('结束时间:', new Date(endTime).toISOString());
      console.log('时间差(毫秒):', diff);

      // 如果时间差为负数，表示已过期
      if (diff <= 0) return '00:00:00';

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return `${days > 0 ? `${days}天 ` : ''}${hours
        .toString()
        .padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    } catch (error) {
      console.error('计算倒计时出错:', error, '时间字符串:', endTimeStr);
      return '00:00:00'; // 出错时返回零时间
    }
  };

  // 返回首页
  const goBack = () => {
    Taro.navigateBack();
  };

  // 处理图片加载错误
  const handleImageError = (e) => {
    e.target.src = 'https://mmbiz.qlogo.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
  };

  // 调试功能 - 临时添加用于检查状态问题
  const debugLottery = async () => {
    try {
      console.log('当前抽奖信息:', lotteryInfo);
      console.log('状态类型:', typeof lotteryInfo.status);
      console.log('状态值:', lotteryInfo.status);
      console.log('结束时间:', new Date(lotteryInfo.endTime));
      console.log('本地结束时间:', lotteryInfo.endTimeLocal);
      console.log('当前时间:', new Date());

      Taro.showModal({
        title: '调试信息',
        content: `状态: ${lotteryInfo.status} (${typeof lotteryInfo.status})\n结束时间: ${lotteryInfo.endTime}\n本地结束时间: ${lotteryInfo.endTimeLocal || '无'}\n当前时间: ${new Date().toISOString()}`,
        showCancel: false
      });
    } catch (error) {
      console.error('调试失败:', error);
    }
  };

  // 渲染加载状态
  if (loading) {
    return (
      <View className='loading-container'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    );
  }

  // 渲染中奖结果（如果抽奖已结束）
  const renderWinners = () => {
    if (!lotteryInfo) {
      return null;
    }

    console.log("渲染中奖名单, 状态:", lotteryInfo.status, "类型:", typeof lotteryInfo.status);

    // 简化判断逻辑 - 统一使用数字状态 (1 表示已结束)
    if (lotteryInfo.status !== 1 ||
        !lotteryInfo.winners ||
        lotteryInfo.winners.length === 0) {
      console.log("无需显示中奖名单");
      return null;
    }

    console.log("显示中奖名单, 人数:", lotteryInfo.winners.length);

    return (
      <View className='winners-section'>
        <Text className='section-title'>中奖名单</Text>
        <View className='winners-list'>
          {lotteryInfo.winners.map((winner, index) => (
            <View key={index} className='winner-item'>
              <Image
                className='winner-avatar'
                src={winner.avatarUrl || 'https://mmbiz.qlogo.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'}
                onError={handleImageError}
              />
              <Text className='winner-name'>
                {winner.nickName || '幸运用户'}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

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

  // 简化判断 - 统一使用数字状态 (0 表示进行中)
  const isActive = lotteryInfo.status === 0;

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

      {/* 调试按钮 - 临时添加 */}
      <Button
        size='mini'
        type='default'
        style={{position: 'absolute', top: '20px', right: '20px', fontSize: '10px', padding: '0 8px'}}
        onClick={debugLottery}
      >
        调试
      </Button>

      {/* 抽奖信息 */}
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
                  : new Date(lotteryInfo.endTimeLocal || lotteryInfo.endTime).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 中奖结果（如果抽奖已结束） */}
      {renderWinners()}

      {/* 参与按钮 */}
      {isActive && (
        <View className='action-area'>
          {joined ? (
            <View className='joined-info'>
              <Text className='joined-text'>已成功参与抽奖</Text>
              <Text className='joined-tips'>
                开奖结果将在{' '}
                {new Date(lotteryInfo.endTimeLocal || lotteryInfo.endTime).toLocaleString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
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
      )}

      {/* 管理员手动开奖按钮 */}
      {isActive && (isCreator || userInfo?.isAdmin) && (
        <View className='admin-actions'>
          <Button className='draw-btn' onClick={handleDrawLottery}>
            手动开奖
          </Button>
        </View>
      )}

      {/* 活动规则 */}
      <View className='rules-section'>
        <Text className='section-title'>活动规则</Text>
        <Text className='rule-item'>1. 每人只能参与一次抽奖</Text>
        <Text className='rule-item'>
          2. 系统将于{' '}
          {new Date(lotteryInfo.endTimeLocal || lotteryInfo.endTime).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          自动开奖
        </Text>
        <Text className='rule-item'>3. 中奖者将显示在中奖名单中</Text>
        <Text className='rule-item'>
          4. 本活动最终解释权归{' '}
          {lotteryInfo.creator?.nickName || '管理员'}{' '}
          所有
        </Text>
      </View>
    </View>
  );
};

export default Detail;