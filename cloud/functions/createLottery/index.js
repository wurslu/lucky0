// cloud/functions/createLottery/index.js (完整修改版)
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
		console.log("当前用户OPENID:", wxContext.OPENID);

		// 检查用户权限 - 同时检查两种可能的字段名称
		const userResult = await userCollection
			.where({
				$or: [{ _openid: wxContext.OPENID }, { openid: wxContext.OPENID }],
			})
			.get();

		console.log("查询用户结果:", userResult);

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

		// 创建抽奖 - 明确使用数字状态 0 表示进行中
		const now = db.serverDate();

		// 计算本地时间 (用于显示)
		const localStartTime = startDateTime.toISOString();
		const localEndTime = endDateTime.toISOString();

		console.log("创建抽奖 - 开始时间:", localStartTime);
		console.log("创建抽奖 - 结束时间:", localEndTime);

		const result = await lotteryCollection.add({
			data: {
				title,
				description: description || title,
				startTime: new Date(startTime),
				endTime: new Date(endTime),
				startTimeLocal: localStartTime,
				endTimeLocal: localEndTime,
				prizeCount: parseInt(prizeCount),
				status: 0, // 只使用数字 0 表示进行中
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
