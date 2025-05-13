// cloud/functions/joinLottery/index.js (修正版)
// 云函数：参与抽奖

const cloud = require("wx-server-sdk");

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

		// 添加调试信息
		console.log("抽奖信息:", lottery);
		console.log("当前状态:", lottery.status);
		console.log("状态类型:", typeof lottery.status);
		console.log("结束时间:", lottery.endTime);
		console.log("当前时间:", new Date());

		// 检查抽奖状态 - 兼容数字和字符串类型
		const status = lottery.status;
		const isActive = status === 0 || status === "0" || status === "active";

		if (!isActive) {
			return {
				success: false,
				message: "该抽奖已结束，无法参与",
			};
		}

		// 检查结束时间
		const endTime = new Date(lottery.endTime);
		const now = new Date();

		if (now > endTime) {
			// 抽奖时间已过
			// 自动更新状态为已结束
			await lotteryCollection.doc(lotteryId).update({
				data: {
					status: 1, // 更新为已结束
					updateTime: db.serverDate(),
				},
			});

			return {
				success: false,
				message: "该抽奖已过期，无法参与",
			};
		}

		// 检查是否已参与
		const participantResult = await participantCollection
			.where({
				lotteryId,
				openid: wxContext.OPENID,
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
				openid: wxContext.OPENID,
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
			message: "参与抽奖失败，请重试",
			error: error.message,
		};
	}
};
