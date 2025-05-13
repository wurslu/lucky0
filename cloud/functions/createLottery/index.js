// cloud/functions/createLottery/index.js (状态格式统一版)
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

	// 验证开奖时间必须大于开始时间
	const startDateTime = new Date(startTime);
	const endDateTime = new Date(endTime);
	if (endDateTime <= startDateTime) {
		return { success: false, message: "开奖时间必须大于开始时间" };
	}

	try {
		// 调试信息
		console.log("当前用户OPENID:", wxContext.OPENID);

		// 检查用户权限 - 优先使用 _openid 字段
		let userResult = await userCollection
			.where({
				_openid: wxContext.OPENID,
			})
			.get();

		console.log("查询用户结果 (_openid):", userResult);

		// 如果没有找到用户，尝试使用 openid 字段
		if (userResult.data.length === 0) {
			userResult = await userCollection
				.where({
					openid: wxContext.OPENID,
				})
				.get();

			console.log("查询用户结果 (openid):", userResult);
		}

		// 如果仍然没有找到用户
		if (userResult.data.length === 0) {
			return {
				success: false,
				message: "用户不存在，请重新登录",
			};
		}

		const user = userResult.data[0];
		console.log("找到用户:", user);

		// 检查是否有创建权限（管理员）
		if (!user.isAdmin) {
			return {
				success: false,
				message: "您没有创建抽奖的权限",
			};
		}

		// 创建抽奖 - 使用数字状态 0 表示进行中
		const now = db.serverDate();
		// 转换为本地时区的时间戳
		const startDateTime = new Date(startTime);
		const endDateTime = new Date(endTime);

		// 转换为UTC时间 (加上时区偏移)
		const startTimeUTC = new Date(
			startDateTime.getTime() - startDateTime.getTimezoneOffset() * 60000
		);
		const endTimeUTC = new Date(
			endDateTime.getTime() - endDateTime.getTimezoneOffset() * 60000
		);

		const result = await lotteryCollection.add({
			data: {
				title,
				description: description || title,
				startTime: startTimeUTC,
				endTime: endTimeUTC,
				// 额外存储一个本地字符串格式，用于显示
				startTimeLocal: startDateTime.toISOString(),
				endTimeLocal: endDateTime.toISOString(),
				prizeCount: parseInt(prizeCount),
				status: 0,
				creatorId: wxContext.OPENID,
				_openid: wxContext.OPENID,
				openid: wxContext.OPENID,
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
			message: "创建抽奖失败，请重试: " + error.message,
			error,
		};
	}
};
