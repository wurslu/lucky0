// client/src/pages/detail/index.jsx
import React, { useState, useEffect, useRef } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Button, Image } from '@tarojs/components';
import {
  getLotteryDetail,
  joinLottery,
  drawLottery,
  completeWxLogin,
} from '../../utils/api';
import {
  formatChineseTime,
  formatShortChineseTime,
  isTimeExpired,
  getCountdownString,
  normalizeTimeString
} from '../../utils/timeUtils';
import { startCountdownTimer } from './timeHandler';
import { debugLottery, testAutoDrawLottery, testCurrentLotteryDraw } from './testUtils';
import { renderWinners } from './renderUtils';
import './index.scss';

const Detail = () => {
  // 获取路由参数
  const [lotteryId, setLotteryId] = useState('');

  // 使用 useRef 存储防止刷新的标志
  const refreshingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // 状态管理
  const [userInfo, setUserInfo] = useState(null);
  const [joined, setJoined] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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
        setIsAdmin(userInfoStored.isAdmin || false);
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

  // 判断抽奖是否已结束 - 仅基于时间判断
  const isLotteryEnded = (endTimeStr) => {
    if (!endTimeStr) return false;
    return isTimeExpired(normalizeTimeString(endTimeStr));
  };

  // 开始倒计时
  const startCountdown = (endTimeStr) => {
    return startCountdownTimer(
      endTimeStr,
      countdownTimer,
      setCountdownTimer,
      setCountdown,
      initialLoadDoneRef,
      refreshingRef,
      fetchLotteryDetail
    );
  };

  // 获取抽奖详情
  const fetchLotteryDetail = async (id) => {
    // 如果正在刷新中，则不重复获取
    if (refreshingRef.current) {
      console.log("已在刷新中，跳过此次请求");
      return;
    }

    // 设置刷新标志
    refreshingRef.current = true;
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
        }
      });
      setLoading(false);
      refreshingRef.current = false;
      return;
    }

    try {
      const result = await getLotteryDetail(id || lotteryId);

      if (result && result.success) {
        console.log('抽奖详情数据:', result.data);

        // 标记初始加载完成
        initialLoadDoneRef.current = true;

        // 更新抽奖信息
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

        // 使用修正后的时间工具判断抽奖是否已结束
        const endTime = result.data.endTimeLocal || result.data.endTime;
        const ended = isTimeExpired(normalizeTimeString(endTime));

        if (!ended) {
          // 抽奖未结束，设置倒计时
          startCountdown(endTime);
        } else {
          // 抽奖已结束，清除定时器
          if (countdownTimer) {
            clearInterval(countdownTimer);
            setCountdownTimer(null);
          }
          setCountdown('00:00:00');
        }
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

      // 3秒后重置刷新标志，允许下次刷新
      setTimeout(() => {
        refreshingRef.current = false;
      }, 3000);
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
      setIsAdmin(result.user?.isAdmin || false);

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

    // 检查抽奖是否已结束
    if (lotteryInfo && isLotteryEnded(lotteryInfo.endTimeLocal || lotteryInfo.endTime)) {
      Taro.showToast({
        title: '抽奖已结束，无法参与',
        icon: 'none',
      });
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

        // 重置刷新标志后刷新抽奖详情
        refreshingRef.current = false;
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
              // 清除倒计时定时器
              if (countdownTimer) {
                clearInterval(countdownTimer);
                setCountdownTimer(null);
              }

              // 设置倒计时为0
              setCountdown('00:00:00');

              Taro.hideLoading();
              Taro.showToast({
                title: '开奖成功',
                icon: 'success',
              });

              // 重置刷新标志后刷新抽奖详情
              refreshingRef.current = false;
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

  // 返回首页
  const goBack = () => {
    Taro.navigateBack();
  };

  // 处理图片加载错误
  const handleImageError = (e) => {
    e.target.src = 'https://mmbiz.qlogo.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
  };

  // 手动刷新按钮
  const handleManualRefresh = () => {
    if (!refreshingRef.current) {
      Taro.showToast({
        title: '正在刷新...',
        icon: 'loading',
        duration: 1000
      });
      refreshingRef.current = false; // 重置刷新标志
      setTimeout(() => {
        fetchLotteryDetail(); // 手动刷新
      }, 1000);
    } else {
      Taro.showToast({
        title: '刷新中，请稍候',
        icon: 'none'
      });
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

  // 判断抽奖是否正在进行中 - 仅基于时间判断
  const isActive = !isLotteryEnded(lotteryInfo.endTimeLocal || lotteryInfo.endTime);

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
        onClick={() => debugLottery(lotteryInfo, initialLoadDoneRef, refreshingRef, countdown)}
      >
        调试
      </Button>

      {/* 测试自动开奖按钮 */}
      {isAdmin && (
        <Button
          size='mini'
          type='primary'
          style={{position: 'absolute', top: '20px', right: '230px', fontSize: '10px', padding: '0 8px'}}
          onClick={() => testAutoDrawLottery(lotteryId, refreshingRef, fetchLotteryDetail)}
        >
          测试自动开奖
        </Button>
      )}

      {/* 测试当前抽奖开奖按钮 */}
      <Button
        size='mini'
        type='primary'
        style={{position: 'absolute', top: '20px', right: '120px', fontSize: '10px', padding: '0 8px'}}
        onClick={() => testCurrentLotteryDraw(lotteryId, refreshingRef, fetchLotteryDetail)}
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
                  : formatShortChineseTime(lotteryInfo.endTimeLocal || lotteryInfo.endTime)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 中奖结果（如果抽奖已结束） */}
      {renderWinners(lotteryInfo, isLotteryEnded, handleImageError)}

      {/* 参与按钮 */}
      {isActive && (
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
    </View>
  );
};

export default Detail;