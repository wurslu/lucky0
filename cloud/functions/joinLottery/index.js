// cloud/functions/joinLottery/index.js (修改版)
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

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

// 判断时间是否已过期
function isExpired(time) {
	if (!time) return false;
	try {
		const formattedTime = formatTime(time);
		const targetTime = new Date(formattedTime);
		const now = new Date();

		if (isNaN(targetTime.getTime())) {
			console.error("无效的时间:", time);
			return false;
		}

		return now >= targetTime;
	} catch (error) {
		console.error("判断时间是否过期出错:", error);
		return false;
	}
}

// 主函数
exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();
	const { lotteryId } = event;

	if (!lotteryId) {
		return {
			success: false,
			message: "抽奖ID不能为空",
		};
	}

	try {
		// 查询抽奖信息
		const lotteryResult = await lotteryCollection.doc(lotteryId).get();

		if (!lotteryResult.data) {
			return {
				success: false,
				message: "未找到抽奖信息",
			};
		}

		const lottery = lotteryResult.data;

		// 确保时间字段格式正确
		if (typeof lottery.endTime === "string" && lottery.endTime.includes("Z")) {
			lottery.endTime = formatTime(lottery.endTime);
			// 异步更新数据库，不等待结果
			lotteryCollection
				.doc(lotteryId)
				.update({
					data: { endTime: lottery.endTime },
				})
				.catch((err) => console.error("更新endTime字段失败:", err));
		}

		// 使用统一函数判断抽奖是否已结束
		const isEnded = isExpired(lottery.endTime);
		console.log(
			"抽奖是否已结束:",
			isEnded,
			"结束时间:",
			formatTime(lottery.endTime)
		);

		if (isEnded) {
			return {
				success: false,
				message: "该抽奖已过期，无法参与",
			};
		}

		// 检查是否已开奖
		if (lottery.hasDrawn) {
			return {
				success: false,
				message: "该抽奖已开奖，无法参与",
			};
		}

		// 检查是否已参与
		const participantResult = await participantCollection
			.where({
				lotteryId,
				_openid: wxContext.OPENID,
			})
			.count();

		if (participantResult.total > 0) {
			return {
				success: false,
				message: "您已参与过该抽奖",
			};
		}

		// 加入抽奖
		await participantCollection.add({
			data: {
				lotteryId,
				_openid: wxContext.OPENID,
				isWinner: false,
				joinTime: db.serverDate(),
				updateTime: db.serverDate(),
			},
		});

		return {
			success: true,
			message: "参与成功",
		};
	} catch (error) {
		console.error("参与抽奖失败:", error);
		return {
			success: false,
			message: "参与抽奖失败，请重试: " + error.message,
			error: error.message,
		};
	}
};
