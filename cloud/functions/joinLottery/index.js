// cloud/functions/joinLottery/index.js - 内联时间工具函数版本
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

// 内联时间工具函数
function normalizeTimeString(timeStr) {
	if (!timeStr) return "";
	try {
		// 如果是日期对象，先转为ISO字符串
		if (timeStr instanceof Date) {
			timeStr = timeStr.toISOString();
		}
		// 如果包含Z后缀，移除它以避免时区问题
		if (typeof timeStr === "string" && timeStr.includes("Z")) {
			return timeStr.replace("Z", "");
		}
		return timeStr;
	} catch (error) {
		console.error("标准化时间字符串出错:", error);
		return timeStr;
	}
}

function isTimeExpired(timeStr) {
	if (!timeStr) return false;
	try {
		const targetTime = new Date(normalizeTimeString(timeStr));
		const now = new Date();
		// 检查日期是否有效
		if (isNaN(targetTime.getTime())) {
			console.error("无效的时间:", timeStr);
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

		// 调试信息
		console.log("抽奖信息:", lottery);
		console.log("结束时间:", lottery.endTime);
		console.log("本地结束时间:", lottery.endTimeLocal);
		console.log("当前时间:", new Date());

		// 使用内联函数判断是否已过期
		const isEnded = isTimeExpired(lottery.endTimeLocal || lottery.endTime);

		if (isEnded) {
			return {
				success: false,
				message: "该抽奖已过期，无法参与",
			};
		}

		// 检查是否已参与 - 统一使用_openid字段
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

		// 加入抽奖 - 使用_openid字段
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
