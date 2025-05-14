// client/src/utils/api.js - 修复版，统一使用_openid
import Taro from "@tarojs/taro";

// 获取微信登录凭证
export const getWxLoginCode = async () => {
  try {
    const loginRes = await Taro.login();
    if (!loginRes.code) {
      throw new Error("微信登录失败");
    }
    return loginRes.code;
  } catch (error) {
    console.error("获取微信登录凭证失败:", error);
    throw error;
  }
};

// 完成微信登录
export const completeWxLogin = async (userInfo) => {
  try {
    console.log("开始登录流程，用户信息:", userInfo);

    // 调用云函数进行登录
    const { result } = await Taro.cloud.callFunction({
      name: "login",
      data: { userInfo },
    });

    console.log("登录云函数返回结果:", result);

    if (result && result.success) {
      // 确保用户信息包含 _openid 字段
      const userData = result.data;

      // 存储用户信息
      Taro.setStorageSync("userInfo", userData);
      console.log("已保存用户信息到本地:", userData);

      return { user: userData };
    } else {
      throw new Error(result?.message || "登录失败");
    }
  } catch (error) {
    console.error("完成微信登录失败:", error);
    throw error;
  }
};

// 检查登录状态
export const checkLoginStatus = async () => {
  const userInfo = Taro.getStorageSync("userInfo");

  if (!userInfo) {
    return { isLoggedIn: false };
  }

  try {
    // 调用云函数验证用户登录状态
    const { result } = await Taro.cloud.callFunction({
      name: "checkLoginStatus",
    });

    if (result && result.openid) {
      return {
        isLoggedIn: true,
        userInfo,
      };
    } else {
      // 登录状态无效，清除本地存储
      Taro.removeStorageSync("userInfo");
      return { isLoggedIn: false };
    }
  } catch (error) {
    console.error("检查登录状态失败:", error);
    // 出错时清除本地存储
    Taro.removeStorageSync("userInfo");
    return { isLoggedIn: false };
  }
};

// 获取用户信息
export const getUserInfo = async () => {
  try {
    const { result } = await Taro.cloud.callFunction({
      name: "getUserInfo",
    });

    if (result && result.success) {
      return { data: result.data };
    } else {
      throw new Error(result?.message || "获取用户信息失败");
    }
  } catch (error) {
    console.error("获取用户信息失败:", error);
    throw error;
  }
};

// 获取抽奖列表
export const getLotteryList = async (params = {}) => {
  console.log("调用getLotteryList API，参数:", params);
  try {
    const { result } = await Taro.cloud.callFunction({
      name: "getLotteryList",
      data: params,
    });

    console.log("getLotteryList返回结果:", result);

    // 检查result是否存在且格式正确
    if (!result) {
      console.error("云函数返回结果为空");
      throw new Error("获取抽奖列表失败，返回结果为空");
    }

    if (!result.success) {
      console.error("云函数返回错误:", result.message);
      throw new Error(result.message || "获取抽奖列表失败");
    }

    // 对抽奖列表进行处理，判断是否已结束（基于时间）
    if (
      result.data &&
      result.data.lotteries &&
      result.data.lotteries.length > 0
    ) {
      const now = new Date();
      result.data.lotteries = result.data.lotteries.map((lottery) => {
        const endTime = new Date(lottery.endTimeLocal || lottery.endTime);
        const isEnded = now >= endTime;
        return {
          ...lottery,
          isEnded: isEnded,
        };
      });
    }

    return result;
  } catch (error) {
    console.error("getLotteryList调用失败:", error);
    throw error;
  }
};

// 获取抽奖详情
export const getLotteryDetail = async (id) => {
  try {
    console.log("调用getLotteryDetail API，参数ID:", id);

    if (!id) {
      throw new Error("抽奖ID不能为空");
    }

    const { result } = await Taro.cloud.callFunction({
      name: "getLotteryDetail",
      data: { id },
    });

    console.log("getLotteryDetail返回结果:", result);

    if (!result) {
      throw new Error("获取抽奖详情失败");
    }

    return result;
  } catch (error) {
    console.error("获取抽奖详情失败:", error);
    throw error;
  }
};

// 创建抽奖
export const createLottery = async (data) => {
  try {
    console.log("开始调用创建抽奖云函数，参数:", data);

    // 确保 prizeCount 是数字类型
    if (data.prizeCount && typeof data.prizeCount === "string") {
      data.prizeCount = parseInt(data.prizeCount);
    }

    // 调用云函数创建抽奖
    const { result } = await Taro.cloud.callFunction({
      name: "createLottery",
      data,
    });

    console.log("创建抽奖云函数返回结果:", result);

    if (!result) {
      throw new Error("创建抽奖失败，返回结果为空");
    }

    return result;
  } catch (error) {
    console.error("创建抽奖失败:", error);
    throw error;
  }
};

// 参与抽奖
export const joinLottery = async (lotteryId) => {
  try {
    const { result } = await Taro.cloud.callFunction({
      name: "joinLottery",
      data: { lotteryId },
    });

    if (!result) {
      throw new Error("参与抽奖失败");
    }

    return result;
  } catch (error) {
    console.error("参与抽奖失败:", error);
    throw error;
  }
};

// 手动开奖
export const drawLottery = async (id) => {
  try {
    const { result } = await Taro.cloud.callFunction({
      name: "drawLottery",
      data: { id },
    });

    if (!result) {
      throw new Error("开奖失败");
    }

    return result;
  } catch (error) {
    console.error("开奖失败:", error);
    throw error;
  }
};

// 用户登录 - 云函数版本 (用户名密码方式)
export const login = async (username, password) => {
  try {
    const { result } = await Taro.cloud.callFunction({
      name: "userLogin",
      data: { username, password },
    });

    if (result && result.success) {
      // 存储用户信息
      Taro.setStorageSync("userInfo", result.data);
      return { success: true, data: { user: result.data } };
    } else {
      return { success: false, message: result?.message || "登录失败" };
    }
  } catch (error) {
    console.error("登录失败:", error);
    return { success: false, message: "登录失败，请重试" };
  }
};

// 用户注册 - 云函数版本
export const register = async (userData) => {
  try {
    const { result } = await Taro.cloud.callFunction({
      name: "userRegister",
      data: userData,
    });

    if (result && result.success) {
      // 存储用户信息
      Taro.setStorageSync("userInfo", result.data);
      return { success: true, data: { user: result.data } };
    } else {
      return { success: false, message: result?.message || "注册失败" };
    }
  } catch (error) {
    console.error("注册失败:", error);
    return { success: false, message: "注册失败，请重试" };
  }
};
