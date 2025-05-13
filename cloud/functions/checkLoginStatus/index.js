// cloud/functions/checkLoginStatus/index.js
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

// 主函数
exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();

	// 如果有openid则表示已登录
	if (wxContext.OPENID) {
		return {
			openid: wxContext.OPENID,
			appid: wxContext.APPID,
			unionid: wxContext.UNIONID,
			isLoggedIn: true,
		};
	} else {
		return {
			isLoggedIn: false,
		};
	}
};
