// cloud/functions/createLottery/index.js (修改版)
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const lotteryCollection = db.collection("lotteries");
const userCollection = db.collection("users");

// 统一的时间处理函数
function formatTime(time) {
	if (!time) return "";
	try {
		// 处理Date对象
		if (time instanceof Date) {
			return time.toISOString().replace("Z", "");
		}
		// 处理字符串
		if (typeof time === "string") {
			return time.replace("Z", "");
		}
		return String(time);
	} catch (error) {
		console.error("格式化时间出错:", error);
		return "";
	}
}

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

	// 统一格式化时间，确保不带Z后缀
	const formattedStartTime = formatTime(startTime || new Date());
	const formattedEndTime = formatTime(endTime);

	console.log("格式化后的开始时间:", formattedStartTime);
	console.log("格式化后的结束时间:", formattedEndTime);

	// 创建Date对象用于比较
	const startDateTime = new Date(formattedStartTime);
	const endDateTime = new Date(formattedEndTime);

	// 验证开奖时间必须大于开始时间
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

		// 添加抽奖记录 - 使用统一格式的时间字符串
		const result = await lotteryCollection.add({
			data: {
				title,
				description: description || title,
				startTime: formattedStartTime, // 存储格式化后的字符串
				endTime: formattedEndTime, // 存储格式化后的字符串
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
