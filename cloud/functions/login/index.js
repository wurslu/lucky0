// cloud/functions/login/index.js
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

// 获取数据库引用
const db = cloud.database();

exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();
	const { userInfo } = event;

	// 没有提供用户信息
	if (!userInfo) {
		return {
			success: false,
			message: "用户信息不完整",
		};
	}

	try {
		// 查询此openid是否已存在
		const userResult = await db
			.collection("users")
			.where({
				_openid: wxContext.OPENID,
			})
			.get();

		if (userResult.data.length > 0) {
			// 用户已存在，更新用户信息
			await db
				.collection("users")
				.where({
					_openid: wxContext.OPENID,
				})
				.update({
					data: {
						nickName: userInfo.nickName,
						avatarUrl: userInfo.avatarUrl,
						lastLoginTime: db.serverDate(),
					},
				});

			// 获取最新的用户信息
			const updatedUser = await db
				.collection("users")
				.where({
					_openid: wxContext.OPENID,
				})
				.get();

			return {
				success: true,
				data: updatedUser.data[0],
			};
		} else {
			// 用户不存在，创建新用户
			const newUser = {
				_openid: wxContext.OPENID,
				nickName: userInfo.nickName,
				avatarUrl: userInfo.avatarUrl,
				isAdmin: false, // 默认非管理员
				createTime: db.serverDate(),
				lastLoginTime: db.serverDate(),
			};

			const addResult = await db.collection("users").add({
				data: newUser,
			});

			newUser._id = addResult._id;

			return {
				success: true,
				data: newUser,
			};
		}
	} catch (error) {
		console.error("微信登录失败", error);
		return {
			success: false,
			message: "登录失败，请重试",
			error: error.message,
		};
	}
};
