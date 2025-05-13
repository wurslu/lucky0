// cloud/functions/joinLottery/index.js (完整修改版)
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

		// 调试信息
		console.log("抽奖信息:", lottery);
		console.log("当前状态:", lottery.status);
		console.log("状态类型:", typeof lottery.status);
		console.log("结束时间:", lottery.endTime);
		console.log("当前时间:", new Date());

		// 如果状态是字符串格式，转换为数字格式并更新数据库
		if (typeof lottery.status === "string") {
			if (lottery.status === "active") {
				lottery.status = 0;
				await lotteryCollection.doc(lotteryId).update({
					data: { status: 0 },
				});
				console.log("已修正状态格式: 'active' -> 0");
			} else if (lottery.status === "completed") {
				lottery.status = 1;
				await lotteryCollection.doc(lotteryId).update({
					data: { status: 1 },
				});
				console.log("已修正状态格式: 'completed' -> 1");
			}
		}

		// 检查抽奖状态 - 只用数字格式判断
		if (lottery.status !== 0) {
			return {
				success: false,
				message: "该抽奖已结束，无法参与",
			};
		}

		// 检查结束时间
		const endTime = new Date(lottery.endTime);
		const now = new Date();

		if (now > endTime) {
			// 抽奖时间已过，自动更新状态为已结束
			await lotteryCollection.doc(lotteryId).update({
				data: {
					status: 1, // 使用数字 1 表示已结束
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
			message: "参与抽奖失败，请重试: " + error.message,
			error: error.message,
		};
	}
};
