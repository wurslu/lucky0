// cloud/functions/login/index.js (优化版)
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
		console.log("当前用户OPENID:", wxContext.OPENID);
		console.log("登录传入的用户信息:", userInfo);

		// 查询此openid是否已存在 - 同时检查两个可能的字段名
		let userResult = await db
			.collection("users")
			.where({
				_openid: wxContext.OPENID,
			})
			.get();

		if (userResult.data.length === 0) {
			// 尝试使用 openid 字段
			userResult = await db
				.collection("users")
				.where({
					openid: wxContext.OPENID,
				})
				.get();
		}

		if (userResult.data.length > 0) {
			// 用户已存在，更新用户信息
			const userData = {
				nickName: userInfo.nickName,
				avatarUrl: userInfo.avatarUrl,
				lastLoginTime: db.serverDate(),
				// 确保两个字段都存在
				_openid: wxContext.OPENID,
				openid: wxContext.OPENID,
			};

			// 根据找到用户的ID更新
			await db.collection("users").doc(userResult.data[0]._id).update({
				data: userData,
			});

			// 获取最新的用户信息
			const updatedUser = await db
				.collection("users")
				.doc(userResult.data[0]._id)
				.get();

			return {
				success: true,
				data: updatedUser.data,
			};
		} else {
			// 用户不存在，创建新用户
			const newUser = {
				_openid: wxContext.OPENID,
				openid: wxContext.OPENID, // 同时存储两个字段
				nickName: userInfo.nickName,
				avatarUrl: userInfo.avatarUrl,
				isAdmin: false, // 默认非管理员
				createTime: db.serverDate(),
				lastLoginTime: db.serverDate(),
			};

			const addResult = await db.collection("users").add({
				data: newUser,
			});

			// 获取完整的新用户记录
			const createdUser = await db.collection("users").doc(addResult._id).get();

			return {
				success: true,
				data: createdUser.data,
			};
		}
	} catch (error) {
		console.error("微信登录失败", error);
		return {
			success: false,
			message: "登录失败，请重试: " + error.message,
			error: error.message,
		};
	}
};
