// cloud/functions/joinLottery/index.js (简化版)
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

// 判断时间是否已过期
function isExpired(time) {
	if (!time) return false;
	try {
		const dateObj = new Date(time);
		return new Date() >= dateObj;
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

		// 使用简化函数判断抽奖是否已结束
		const isEnded = isExpired(lottery.endTime);
		console.log("抽奖是否已结束:", isEnded, "结束时间:", lottery.endTime);

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
