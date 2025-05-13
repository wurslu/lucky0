// src/utils/api.js (云开发版)
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

// 完成微信登录流程 - 云函数版本
export const completeWxLogin = async (userInfo) => {
  try {
    // 调用云函数进行登录
    const { result } = await Taro.cloud.callFunction({
      name: "login",
      data: { userInfo },
    });

    if (result && result.success) {
      // 存储用户信息
      Taro.setStorageSync("userInfo", result.data);
      return { user: result.data };
    } else {
      throw new Error(result?.message || "登录失败");
    }
  } catch (error) {
    console.error("完成微信登录失败:", error);
    throw error;
  }
};

// 检查登录状态 - 云函数版本
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

// 获取用户信息 - 云函数版本
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

    return result;
  } catch (error) {
    console.error("getLotteryList调用失败:", error);
    throw error;
  }
};

// 获取抽奖详情 - 云函数版本
export const getLotteryDetail = async (id) => {
  try {
    const { result } = await Taro.cloud.callFunction({
      name: "getLotteryDetail",
      data: { id },
    });

    if (!result) {
      throw new Error("获取抽奖详情失败");
    }

    return result;
  } catch (error) {
    console.error("获取抽奖详情失败:", error);
    throw error;
  }
};

// 创建抽奖活动 - 云函数版本
export const createLottery = async (data) => {
  try {
    const { result } = await Taro.cloud.callFunction({
      name: "createLottery",
      data,
    });

    if (!result) {
      throw new Error("创建抽奖失败");
    }

    return result;
  } catch (error) {
    console.error("创建抽奖失败:", error);
    throw error;
  }
};

// 参与抽奖 - 云函数版本
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

// 手动开奖 - 云函数版本
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
