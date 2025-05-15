// cloud/functions/createLottery/index.js - 使用公共模块版本
const cloud = require("wx-server-sdk");
const { timeHelper } = require("common");

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

	// 规范化时间字符串，确保没有时区问题
	const normalizedStartTime = timeHelper.normalizeTimeString(
		startTime || timeHelper.getCurrentStandardTime()
	);
	const normalizedEndTime = timeHelper.normalizeTimeString(endTime);

	console.log("规范化后的开始时间:", normalizedStartTime);
	console.log("规范化后的结束时间:", normalizedEndTime);

	// 验证开奖时间必须大于开始时间
	const startDateTime = new Date(normalizedStartTime);
	const endDateTime = new Date(normalizedEndTime);

	console.log("开始时间Date:", startDateTime);
	console.log("结束时间Date:", endDateTime);

	if (endDateTime <= startDateTime) {
		return { success: false, message: "开奖时间必须大于开始时间" };
	}

	try {
		console.log("当前用户OPENID:", wxContext.OPENID);

		// 检查用户权限 - 只使用_openid字段
		const userResult = await userCollection
			.where({
				_openid: wxContext.OPENID,
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

		// 创建抽奖
		const now = db.serverDate();

		const result = await lotteryCollection.add({
			data: {
				title,
				description: description || title,
				// 存储原始时间字符串，避免Date对象自动转换为UTC
				startTimeLocal: normalizedStartTime,
				endTimeLocal: normalizedEndTime,
				// 也存储Date对象用于查询
				startTime: startDateTime,
				endTime: endDateTime,
				prizeCount: parseInt(prizeCount),
				creatorId: wxContext.OPENID,
				_openid: wxContext.OPENID, // 只使用_openid
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
			message: "创建抽奖失败，请重试: " + (error.message || "未知错误"),
			error,
		};
	}
};
