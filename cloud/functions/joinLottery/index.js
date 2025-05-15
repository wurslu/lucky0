// cloud/functions/joinLottery/index.js - 使用公共模块版本
const cloud = require("wx-server-sdk");
const { timeHelper } = require("common");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

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

		// 检查结束时间 - 使用timeHelper判断抽奖是否已结束
		const isEnded = timeHelper.isTimeExpired(
			lottery.endTimeLocal || lottery.endTime
		);

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
