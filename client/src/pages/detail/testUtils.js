// client/src/pages/detail/testUtils.js
// 创建缺失的 testUtils.js 文件
import Taro from "@tarojs/taro";
import { formatChineseTime } from "../../utils/timeUtils";

/**
 * 调试功能 - 显示当前抽奖时间和状态信息
 */
export const debugLottery = async (
  lotteryInfo,
  initialLoadDoneRef,
  refreshingRef,
  countdown
) => {
  try {
    const isEnded = lotteryInfo
      ? new Date() >= new Date(lotteryInfo.endTime)
      : false;
    const now = new Date();

    console.log("当前抽奖信息:", lotteryInfo);
    console.log("原始结束时间:", lotteryInfo ? lotteryInfo.endTime : null);
    console.log("本地结束时间:", lotteryInfo ? lotteryInfo.endTimeLocal : null);
    console.log("当前时间:", formatChineseTime(now));
    console.log("当前时间ISO:", now.toISOString());
    console.log("是否已结束(基于时间):", isEnded);
    console.log("刷新中标志:", refreshingRef.current);
    console.log("初始加载完成标志:", initialLoadDoneRef.current);

    Taro.showModal({
      title: "时间调试信息",
      content: `原始结束时间: ${lotteryInfo ? lotteryInfo.endTime : "null"}
本地结束时间: ${lotteryInfo ? lotteryInfo.endTimeLocal || "无" : "null"}
当前时间: ${formatChineseTime(now)}
ISO当前时间: ${now.toISOString()}
是否已结束: ${isEnded}
刷新中: ${refreshingRef.current}
初始加载完成: ${initialLoadDoneRef.current}
倒计时: ${countdown}
参与人数: ${lotteryInfo.participants ? lotteryInfo.participants.length : 0}
中奖者人数: ${lotteryInfo.winners ? lotteryInfo.winners.length : 0}`,
      showCancel: false,
    });
  } catch (error) {
    console.error("调试失败:", error);
  }
};

/**
 * 测试自动开奖功能
 */
export const testAutoDrawLottery = async (
  lotteryId,
  refreshingRef,
  fetchLotteryDetail
) => {
  try {
    Taro.showLoading({ title: "测试中..." });

    // 调用测试云函数
    const { result } = await Taro.cloud.callFunction({
      name: "autoDrawLottery",
      data: {},
    });

    Taro.hideLoading();

    console.log("测试自动开奖结果:", result);

    if (result && result.success) {
      let message = `处理了 ${result.results?.length || 0} 个抽奖活动`;

      // 查找当前抽奖是否在处理列表中
      const currentLottery = result.results?.find(
        (item) => item.lotteryId === lotteryId
      );
      if (currentLottery) {
        message += `\n\n当前抽奖处理结果: ${currentLottery.message}`;
      } else {
        message += "\n\n当前抽奖不在处理列表中";
      }

      Taro.showModal({
        title: "测试结果",
        content: message,
        showCancel: false,
        success: () => {
          // 刷新当前页面
          setTimeout(() => {
            refreshingRef.current = false;
            fetchLotteryDetail();
          }, 1000);
        },
      });
    } else {
      Taro.showModal({
        title: "测试结果",
        content: `自动开奖测试失败: ${result?.message || "未知错误"}`,
        showCancel: false,
      });
    }
  } catch (error) {
    console.error("测试自动开奖失败:", error);
    Taro.hideLoading();
    Taro.showToast({
      title: "测试失败",
      icon: "none",
    });
  }
};

/**
 * 测试当前抽奖的开奖功能
 */
export const testCurrentLotteryDraw = async (
  lotteryId,
  refreshingRef,
  fetchLotteryDetail
) => {
  try {
    if (!lotteryId) {
      Taro.showToast({
        title: "抽奖ID为空",
        icon: "none",
      });
      return;
    }

    // 确认开奖
    const confirmResult = await Taro.showModal({
      title: "测试当前抽奖开奖",
      content: "这将直接对当前抽奖执行开奖操作，确定继续吗？",
      confirmText: "确定开奖",
      cancelText: "取消",
    });

    if (!confirmResult.confirm) {
      return;
    }

    Taro.showLoading({ title: "正在测试开奖..." });

    // 调用测试云函数
    const { result } = await Taro.cloud.callFunction({
      name: "testDrawSpecificLottery",
      data: { lotteryId },
    });

    Taro.hideLoading();

    console.log("测试当前抽奖开奖结果:", result);

    if (result && result.success) {
      Taro.showModal({
        title: "测试开奖成功",
        content: `成功设置 ${result.data?.winnerCount || 0} 名中奖者`,
        showCancel: false,
        success: () => {
          // 刷新页面
          setTimeout(() => {
            refreshingRef.current = false;
            fetchLotteryDetail();
          }, 1000);
        },
      });
    } else {
      Taro.showModal({
        title: "测试开奖失败",
        content: result?.message || "未知错误",
        showCancel: false,
      });
    }
  } catch (error) {
    console.error("测试开奖出错:", error);
    Taro.hideLoading();
    Taro.showToast({
      title: "测试失败",
      icon: "none",
    });
  }
};
