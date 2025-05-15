// cloud/functions/createLottery/index.js (修复版)
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const lotteryCollection = db.collection("lotteries");
const userCollection = db.collection("users");

// 简化的时间处理函数
const formatTime = (time) => {
	if (!time) return "";
	try {
		let timeStr = time;
		if (time instanceof Date) {
			timeStr = time.toISOString();
		}
		return typeof timeStr === "string" ? timeStr.replace("Z", "") : "";
	} catch (error) {
		console.error("格式化时间出错:", error);
		return "";
	}
};

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

	// 规范化时间
	const formattedStartTime = formatTime(startTime || new Date());
	const formattedEndTime = formatTime(endTime);

	console.log("格式化后的开始时间:", formattedStartTime);
	console.log("格式化后的结束时间:", formattedEndTime);

	// 验证开奖时间必须大于开始时间
	const startDateTime = new Date(formattedStartTime);
	const endDateTime = new Date(formattedEndTime);

	if (endDateTime <= startDateTime) {
		return { success: false, message: "开奖时间必须大于开始时间" };
	}

	try {
		console.log("当前用户OPENID:", wxContext.OPENID);

		// 检查用户权限
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
				startTime: startDateTime, // 存储Date对象用于查询
				endTime: endDateTime, // 存储Date对象用于查询
				prizeCount: parseInt(prizeCount),
				_openid: wxContext.OPENID, // 统一使用_openid
				createTime: now,
				updateTime: now,
				hasDrawn: false,
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
