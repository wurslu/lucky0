// cloud/functions/getUserInfo/index.js
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

// 获取数据库引用
const db = cloud.database();

// 主函数
exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();
	const { openid } = event;

	// 如果传入了指定openid则查询该用户，否则查询当前用户
	const targetOpenid = openid || wxContext.OPENID;

	// 没有openid则返回错误
	if (!targetOpenid) {
		return {
			success: false,
			message: "用户未登录",
		};
	}

	try {
		// 查询用户信息
		const userResult = await db
			.collection("users")
			.where({
				_openid: targetOpenid,
			})
			.get();

		if (userResult.data.length > 0) {
			return {
				success: true,
				data: userResult.data[0],
			};
		} else {
			return {
				success: false,
				message: "用户不存在",
			};
		}
	} catch (error) {
		console.error("获取用户信息失败", error);
		return {
			success: false,
			message: "获取用户信息失败",
			error: error.message,
		};
	}
};
