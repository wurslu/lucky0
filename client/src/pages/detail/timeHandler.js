// client/src/pages/detail/timeHandler.js (修复版)
import {
  formatChineseTime,
  getCountdownString,
  formatTime,
} from "../../utils/timeUtils";

/**
 * 处理倒计时逻辑
 */
export const startCountdownTimer = (
  endTime,
  countdownTimer,
  setCountdownTimer,
  setCountdown,
  initialLoadDoneRef,
  refreshingRef,
  fetchLotteryDetail,
  lotteryId
) => {
  // 清除可能存在的之前的定时器
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  try {
    // 格式化结束时间，去除Z后缀
    const formattedEndTime = formatTime(endTime);
    console.log("格式化后的结束时间:", formattedEndTime);

    // 首先验证结束时间是否有效
    const endDateTime = new Date(formattedEndTime);
    const now = new Date();

    console.log("开始倒计时，当前时间:", formatChineseTime(now));
    console.log("目标时间:", formatChineseTime(endDateTime));

    // 检查日期是否有效
    if (isNaN(endDateTime.getTime())) {
      console.error("无效的结束时间:", formattedEndTime);
      setCountdown("无效的时间");
      return;
    }

    // 如果结束时间已过，直接显示00:00:00
    if (now >= endDateTime) {
      console.log("结束时间已过，显示零时间");
      setCountdown("00:00:00");

      // 只刷新一次，避免重复刷新
      if (initialLoadDoneRef.current && !refreshingRef.current) {
        console.log("抽奖结束后首次刷新数据");

        // 设置刷新标志
        refreshingRef.current = true;

        // 设置延迟，确保不会立即刷新
        setTimeout(() => {
          // 传入lotteryId作为参数
          if (lotteryId) {
            fetchLotteryDetail(lotteryId);
          } else {
            console.error("无法刷新抽奖详情：lotteryId为空");
          }

          // 设置定时再次刷新一次，获取可能的开奖结果
          setTimeout(() => {
            console.log("再次尝试刷新以获取开奖结果");
            refreshingRef.current = false; // 重置刷新标志

            // 传入lotteryId作为参数
            if (lotteryId) {
              fetchLotteryDetail(lotteryId);
            } else {
              console.error("无法刷新抽奖详情：lotteryId为空");
            }
          }, 8000); // 8秒后再次刷新
        }, 3000);
      }
      return;
    }

    // 使用工具函数获取倒计时字符串
    setCountdown(getCountdownString(formattedEndTime));

    // 设置新的定时器 - 每秒更新一次
    const timer = setInterval(() => {
      const countdown = getCountdownString(formattedEndTime);
      setCountdown(countdown);

      // 如果倒计时结束，清除定时器并刷新数据
      if (countdown === "00:00:00") {
        clearInterval(timer);
        console.log("倒计时结束，刷新数据");

        // 设置刷新标志
        refreshingRef.current = true;

        // 延迟几秒后再刷新，给自动开奖云函数时间执行
        setTimeout(() => {
          // 传入lotteryId作为参数
          if (lotteryId) {
            fetchLotteryDetail(lotteryId);
          } else {
            console.error("无法刷新抽奖详情：lotteryId为空");
          }

          // 5秒后再次刷新以获取最新开奖结果
          setTimeout(() => {
            console.log("再次尝试获取开奖结果");
            refreshingRef.current = false; // 重置刷新标志

            // 传入lotteryId作为参数
            if (lotteryId) {
              fetchLotteryDetail(lotteryId);
            } else {
              console.error("无法刷新抽奖详情：lotteryId为空");
            }
          }, 5000);
        }, 3000);
      }
    }, 1000);

    setCountdownTimer(timer);
    return timer;
  } catch (error) {
    console.error("启动倒计时出错:", error);
    setCountdown("计时错误");
    return null;
  }
};
