// Fixed useDetail.js with improved auto-draw handling
import { useState, useEffect, useRef } from "react";
import Taro from "@tarojs/taro";
import {
  getLotteryDetail,
  joinLottery,
  drawLottery,
  completeWxLogin,
} from "../../../utils/api";
import { startCountdownTimer } from "../timeHandler";
import { isExpired } from "../../../utils/timeUtils";

/**
 * 抽奖详情状态管理Hook - 修复自动开奖问题
 */
export function useDetail() {
  // 获取路由参数
  const [lotteryId, setLotteryId] = useState("");

  // 使用 useRef 存储防止刷新的标志
  const refreshingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const autoRefreshTimerRef = useRef(null);

  // 状态管理
  const [userInfo, setUserInfo] = useState(null);
  const [joined, setJoined] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lotteryInfo, setLotteryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("00:00:00");
  const [countdownTimer, setCountdownTimer] = useState(null);

  // 判断当前用户是否是中奖者
  const isUserWinner = () => {
    if (!userInfo || !lotteryInfo || !lotteryInfo.winners) return false;
    return lotteryInfo.winners.some(
      (winner) => winner._openid === userInfo._openid
    );
  };

  // 清除所有定时器的函数
  const clearAllTimers = () => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }

    if (autoRefreshTimerRef.current) {
      clearTimeout(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
  };

  useEffect(() => {
    const params = Taro.getCurrentInstance().router.params;
    console.log("获取到路由参数:", params);

    if (params && params.lotteryId) {
      console.log("获取到抽奖ID:", params.lotteryId);
      setLotteryId(params.lotteryId);

      // 将lotteryId存储到本地，防止刷新丢失
      Taro.setStorageSync("currentLotteryId", params.lotteryId);

      // 从本地获取用户信息
      const userInfoStored = Taro.getStorageSync("userInfo");
      if (userInfoStored) {
        setUserInfo(userInfoStored);
        setIsAdmin(userInfoStored.isAdmin || false);
      }

      // 获取抽奖详情
      fetchLotteryDetail(params.lotteryId);
    } else {
      // 尝试从本地存储获取lotteryId
      const storedLotteryId = Taro.getStorageSync("currentLotteryId");

      if (storedLotteryId) {
        console.log("从本地存储获取到抽奖ID:", storedLotteryId);
        setLotteryId(storedLotteryId);

        // 获取抽奖详情
        fetchLotteryDetail(storedLotteryId);
      } else {
        console.error("未获取到抽奖ID");
        Taro.showToast({
          title: "未找到抽奖信息",
          icon: "none",
          complete: () => {
            setTimeout(() => {
              Taro.navigateBack();
            }, 1500);
          },
        });
      }
    }

    // 组件卸载时清除定时器
    return () => {
      clearAllTimers();
    };
  }, []);

  // 判断抽奖是否已结束 - 仅基于时间判断
  const isLotteryEnded = (endTime) => {
    if (!endTime) return false;
    return isExpired(endTime);
  };

  // 开始倒计时
  const startCountdown = (endTime) => {
    return startCountdownTimer(
      endTime,
      countdownTimer,
      setCountdownTimer,
      setCountdown,
      initialLoadDoneRef,
      refreshingRef,
      fetchLotteryDetail,
      lotteryId
    );
  };

  // 获取抽奖详情
  const fetchLotteryDetail = async (id, force = false) => {
    // 如果正在刷新中且不是强制刷新，则不重复获取
    if (refreshingRef.current && !force) {
      console.log("已在刷新中，跳过此次请求");
      return;
    }

    // 设置刷新标志
    refreshingRef.current = true;
    setLoading(true);

    // 优先使用传入的ID，否则使用state中的ID
    const lotteryIdToUse =
      id || lotteryId || Taro.getStorageSync("currentLotteryId");

    console.log("开始获取抽奖详情，ID:", lotteryIdToUse);

    if (!lotteryIdToUse) {
      console.error("抽奖ID为空，无法获取详情");
      Taro.showToast({
        title: "抽奖ID不能为空",
        icon: "none",
        complete: () => {
          setTimeout(() => {
            Taro.navigateBack();
          }, 1500);
        },
      });
      setLoading(false);
      refreshingRef.current = false;
      return;
    }

    try {
      const result = await getLotteryDetail(lotteryIdToUse);

      if (result && result.success) {
        console.log("抽奖详情数据:", result.data);

        // 标记初始加载完成
        initialLoadDoneRef.current = true;

        // 清除任何现有定时器
        clearAllTimers();

        // 更新抽奖信息
        setLotteryInfo(result.data);

        // 检查当前用户是否是创建者 - 使用_openid
        if (userInfo && result.data._openid === userInfo._openid) {
          setIsCreator(true);
        }

        // 检查当前用户是否已参与 - 使用_openid
        if (userInfo && result.data.participants) {
          const hasJoined = result.data.participants.some(
            (p) => p._openid === userInfo._openid
          );
          setJoined(hasJoined);
        }

        // 判断是否已经开奖
        const isAlreadyDrawn =
          result.data.hasDrawn ||
          (result.data.winners && result.data.winners.length > 0);

        // 检查是否无人参与但已开奖
        const isNoParticipants =
          result.data.noParticipants && result.data.hasDrawn;

        // 判断抽奖是否已结束
        const ended = isLotteryEnded(result.data.endTime);

        // 如果已开奖或无人参与，停止倒计时
        if (isAlreadyDrawn || isNoParticipants) {
          clearAllTimers();
          setCountdown("00:00:00");
        } else if (!ended) {
          // 抽奖未结束且未开奖，设置倒计时
          startCountdown(result.data.endTime);
        } else {
          // 抽奖已结束但未开奖，可能云函数延迟，设置自动检查
          clearAllTimers();
          setCountdown("00:00:00");

          // 如果已结束但未开奖，设置自动刷新检查开奖结果
          if (!isAlreadyDrawn && !isNoParticipants) {
            console.log("抽奖已结束但未开奖，设置自动检查序列");

            // 延迟序列，检查开奖结果
            const checkTimes = [3000, 6000, 10000, 15000];
            let checkIndex = 0;

            const scheduleNextCheck = () => {
              if (checkIndex < checkTimes.length) {
                autoRefreshTimerRef.current = setTimeout(() => {
                  console.log(`自动检查开奖结果 #${checkIndex + 1}`);
                  refreshingRef.current = false; // 重置刷新标志
                  fetchLotteryDetail(lotteryIdToUse, true);
                  checkIndex++;
                  scheduleNextCheck();
                }, checkTimes[checkIndex]);
              }
            };

            scheduleNextCheck();
          }
        }
      } else {
        console.error("获取抽奖详情失败:", result?.message);
        Taro.showToast({
          title: result?.message || "获取抽奖详情失败",
          icon: "none",
          complete: () => {
            setTimeout(() => {
              Taro.navigateBack();
            }, 1500);
          },
        });
      }
    } catch (error) {
      console.error("获取抽奖详情失败", error);
      Taro.showToast({
        title: "获取抽奖详情失败",
        icon: "none",
        complete: () => {
          setTimeout(() => {
            Taro.navigateBack();
          }, 1500);
        },
      });
    } finally {
      setLoading(false);

      // 重置刷新标志，允许下次刷新
      setTimeout(() => {
        refreshingRef.current = false;
      }, 2000);
    }
  };

  // 处理微信登录并参与抽奖
  const handleLoginAndJoin = async () => {
    try {
      Taro.showLoading({ title: "登录中..." });

      // 1. 获取用户信息
      const { userInfo: wxUserInfo } = await Taro.getUserProfile({
        desc: "用于完善会员资料",
      });

      // 2. 使用云函数完成登录
      const result = await completeWxLogin(wxUserInfo);

      // 更新本地状态
      setUserInfo(result.user);
      setIsAdmin(result.user?.isAdmin || false);

      Taro.hideLoading();
      Taro.showToast({
        title: "登录成功",
        icon: "success",
        duration: 1000,
      });

      // 登录成功后自动参与抽奖
      setTimeout(() => {
        handleJoinLottery();
      }, 1000);
    } catch (error) {
      console.error("微信登录失败:", error);
      Taro.hideLoading();
      Taro.showToast({
        title: "登录失败，请重试",
        icon: "none",
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
    if (lotteryInfo && isLotteryEnded(lotteryInfo.endTime)) {
      Taro.showToast({
        title: "抽奖已结束，无法参与",
        icon: "none",
      });
      return;
    }

    // 检查抽奖是否已经开奖
    if (lotteryInfo && (lotteryInfo.hasDrawn || lotteryInfo.noParticipants)) {
      Taro.showToast({
        title: "抽奖已开奖，无法参与",
        icon: "none",
      });
      return;
    }

    Taro.showLoading({ title: "参与中..." });

    try {
      const result = await joinLottery(lotteryId);

      if (result && result.success) {
        setJoined(true);

        Taro.hideLoading();
        Taro.showToast({
          title: "参与成功",
          icon: "success",
        });

        // 重置刷新标志后刷新抽奖详情
        refreshingRef.current = false;
        setTimeout(() => {
          fetchLotteryDetail(lotteryId, true);
        }, 1000);
      } else {
        Taro.hideLoading();
        Taro.showToast({
          title: result?.message || "参与失败",
          icon: "none",
        });
      }
    } catch (error) {
      console.error("参与抽奖失败", error);
      Taro.hideLoading();
      Taro.showToast({
        title: "参与失败，请重试",
        icon: "none",
      });
    }
  };

  // 手动开奖（仅管理员可用）
  const handleDrawLottery = async () => {
    if (!isCreator && !userInfo?.isAdmin) {
      Taro.showToast({
        title: "无权操作",
        icon: "none",
      });
      return;
    }

    // 确认是否开奖
    Taro.showModal({
      title: "手动开奖",
      content: "确定要立即开奖吗？开奖后无法撤销。",
      success: async (res) => {
        if (res.confirm) {
          Taro.showLoading({ title: "开奖中..." });

          try {
            const result = await drawLottery(lotteryId);

            if (result && result.success) {
              // 清除倒计时定时器
              clearAllTimers();

              // 设置倒计时为0
              setCountdown("00:00:00");

              Taro.hideLoading();

              // 根据是否有人参与显示不同提示
              if (result.data.noParticipants) {
                Taro.showToast({
                  title: "已开奖，无人参与",
                  icon: "none",
                  duration: 2000,
                });
              } else {
                Taro.showToast({
                  title: "开奖成功",
                  icon: "success",
                  duration: 2000,
                });
              }

              // 重置刷新标志后刷新抽奖详情
              refreshingRef.current = false;
              setTimeout(() => {
                fetchLotteryDetail(lotteryId, true);
              }, 1000);
            } else {
              Taro.hideLoading();
              Taro.showToast({
                title: result?.message || "开奖失败",
                icon: "none",
              });
            }
          } catch (error) {
            console.error("开奖失败", error);
            Taro.hideLoading();
            Taro.showToast({
              title: "开奖失败，请重试",
              icon: "none",
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
      title: "点击右上角分享给好友",
      icon: "none",
    });
  };

  // 返回上一页
  const goBack = () => {
    Taro.navigateBack();
  };

  // 处理图片加载错误
  const handleImageError = (e) => {
    e.target.src =
      "https://mmbiz.qlogo.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0";
  };

  // 手动刷新按钮
  const handleManualRefresh = () => {
    if (!refreshingRef.current) {
      Taro.showLoading({
        title: "正在刷新...",
        mask: true,
      });

      // 设置刷新标志
      refreshingRef.current = true;

      // 强制刷新
      fetchLotteryDetail(lotteryId, true);

      // 延迟关闭加载提示
      setTimeout(() => {
        Taro.hideLoading();
        Taro.showToast({
          title: "刷新完成",
          icon: "success",
          duration: 1000,
        });
      }, 1500);
    } else {
      Taro.showToast({
        title: "刷新中，请稍候",
        icon: "none",
      });
    }
  };

  // 测试函数 - 在开发环境中使用
  const testUtils = {
    debugLottery: (debugFn) => {
      if (debugFn && typeof debugFn === "function") {
        debugFn(lotteryInfo, initialLoadDoneRef, refreshingRef, countdown);
      }
    },
    testAutoDrawLottery: (testFn) => {
      if (testFn && typeof testFn === "function") {
        testFn(lotteryId, refreshingRef, fetchLotteryDetail);
      }
    },
    testCurrentLotteryDraw: (testFn) => {
      if (testFn && typeof testFn === "function") {
        testFn(lotteryId, refreshingRef, fetchLotteryDetail);
      }
    },
  };

  // 判断抽奖是否正在进行中
  const isActive = () => {
    if (!lotteryInfo) return false;

    return (
      !isLotteryEnded(lotteryInfo.endTime) &&
      !lotteryInfo.hasDrawn &&
      !lotteryInfo.noParticipants
    );
  };

  // 内联时间格式化函数
  const formatChineseTime = (time) => {
    if (!time) return "";
    const date = new Date(time);
    return date
      .toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-");
  };

  const formatShortChineseTime = (time) => {
    if (!time) return "";
    const date = new Date(time);
    return date
      .toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-");
  };

  return {
    loading,
    lotteryInfo,
    lotteryId,
    userInfo,
    joined,
    isCreator,
    isAdmin,
    countdown,
    isLotteryEnded,
    isActive: isActive(),
    handleJoinLottery,
    handleDrawLottery,
    handleShare,
    goBack,
    handleImageError,
    handleManualRefresh,
    testUtils,
    formatChineseTime,
    formatShortChineseTime,
    isUserWinner: isUserWinner(),
  };
}
