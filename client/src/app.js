import Taro from "@tarojs/taro";
import { Component } from "react";
import "./app.scss";

// 初始化云开发环境
Taro.cloud.init({
  env: "locky0-3ggq0p850d9a49ee", // 替换成您的云开发环境ID
  traceUser: true, // 是否在将用户访问记录到用户管理中，在控制台中可见
});

class App extends Component {
  componentDidMount() {
    // 检查用户登录状态
    this.checkLoginStatus();
  }

  // 检查登录状态
  async checkLoginStatus() {
    try {
      // 获取本地存储的用户信息
      const userInfo = Taro.getStorageSync("userInfo");

      if (userInfo) {
        this.setState({
          userInfo,
          hasLogin: true,
        });
      } else {
        // 尝试获取云开发的用户身份信息
        const { result } = await Taro.cloud.callFunction({
          name: "checkLoginStatus",
        });

        if (result && result.openid) {
          // 有登录态但本地无缓存，获取用户资料并保存
          const { result: userResult } = await Taro.cloud.callFunction({
            name: "getUserInfo",
            data: { openid: result.openid },
          });

          if (userResult && userResult.data) {
            Taro.setStorageSync("userInfo", userResult.data);
            this.setState({
              userInfo: userResult.data,
              hasLogin: true,
            });
          }
        }
      }
    } catch (error) {
      console.error("检查登录状态失败", error);
    }
  }

  // 程序启动时
  componentDidShow(options) {
    console.log("App onShow", options);
  }

  // 程序隐藏时
  componentDidHide() {
    console.log("App onHide");
  }

  // 渲染
  render() {
    // this.props.children 是将要会渲染的页面
    return this.props.children;
  }
}

export default App;
