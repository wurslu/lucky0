// cloud/functions/createLottery/index.js
// 云函数：创建抽奖

const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const lotteryCollection = db.collection("lotteries");
const userCollection = db.collection("users");

// 主函数
exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();
	const { title, description, startTime, endTime, prizeCount } = event;

	// 参数验证
	if (!title) {
		return { success: false, message: "标题不能为空" };
	}

	if (!endTime) {
		return { success: false, message: "开奖时间不能为空" };
	}

	if (!prizeCount || prizeCount < 1) {
		return { success: false, message: "奖品数量至少为1" };
	}

	try {
		// 检查用户权限
		const userResult = await userCollection
			.where({
				openid: wxContext.OPENID,
			})
			.get();

		if (userResult.data.length === 0) {
			return {
				success: false,
				message: "用户不存在",
			};
		}

		const user = userResult.data[0];

		// 检查是否有创建权限（管理员）
		if (!user.isAdmin) {
			return {
				success: false,
				message: "您没有创建抽奖的权限",
			};
		}

		// 创建抽奖
		const now = db.serverDate();
		const result = await lotteryCollection.add({
			data: {
				title,
				description: description || title,
				startTime: new Date(startTime),
				endTime: new Date(endTime),
				prizeCount: parseInt(prizeCount),
				status: "active", // 活动状态：active - 进行中，completed - 已结束
				creatorId: wxContext.OPENID,
				createTime: now,
				updateTime: now,
			},
		});

		// 获取创建后的抽奖信息
		const lotteryResult = await lotteryCollection.doc(result._id).get();

		return {
			success: true,
			data: lotteryResult.data,
		};
	} catch (error) {
		console.error("创建抽奖失败", error);
		return {
			success: false,
			message: "创建抽奖失败，请重试",
			error,
		};
	}
};
