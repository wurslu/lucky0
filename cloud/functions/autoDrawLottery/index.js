// 云函数：自动开奖（定时触发）

const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

// 随机选择函数
function getRandomItems(array, count) {
	const shuffled = [...array].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, Math.min(count, array.length));
}

// 主函数
exports.main = async (event, context) => {
	try {
		const now = new Date();
		console.log("自动开奖函数执行，当前时间:", now.toISOString());

		// 查询所有已到开奖时间但未开奖的抽奖活动
		// 兼容两种状态格式，但会统一转换为数字格式
		const lotteryResult = await lotteryCollection
			.where(
				_.or([
					{ status: 0, endTime: _.lte(now) },
					{ status: "active", endTime: _.lte(now) },
				])
			)
			.get();

		const lotteries = lotteryResult.data;
		console.log("找到需要自动开奖的活动:", lotteries.length);

		if (lotteries.length === 0) {
			return {
				success: true,
				message: "没有需要自动开奖的活动",
			};
		}

		// 处理每个需要开奖的活动
		const results = [];

		for (const lottery of lotteries) {
			try {
				console.log("处理抽奖:", lottery._id, lottery.title);

				// 查询所有参与者
				const participantsResult = await participantCollection
					.where({
						lotteryId: lottery._id,
					})
					.get();

				const participants = participantsResult.data;
				console.log("参与者数量:", participants.length);

				// 首先更新抽奖状态为已结束，统一使用数字格式
				await lotteryCollection.doc(lottery._id).update({
					data: {
						status: 1, // 统一使用数字 1 表示已结束
						updateTime: db.serverDate(),
						winnerCount: 0, // 默认设置为0
					},
				});

				if (participants.length === 0) {
					// 无人参与，已标记为已结束
					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						status: 1,
						message: "无人参与，已结束",
					});
					continue;
				}

				// 确定中奖人数（不超过参与人数和设置的奖品数量）
				const winnerCount = Math.min(lottery.prizeCount, participants.length);
				console.log("中奖人数:", winnerCount);

				// 随机选取中奖者
				const winners = getRandomItems(participants, winnerCount);
				const winnerIds = winners.map((w) => w._id);
				console.log("选取的中奖者:", winnerIds.length);

				// 更新中奖者状态
				if (winnerIds.length > 0) {
					await participantCollection
						.where({
							_id: _.in(winnerIds),
						})
						.update({
							data: {
								isWinner: true,
								updateTime: db.serverDate(),
							},
						});
				}

				// 更新抽奖记录的中奖人数
				await lotteryCollection.doc(lottery._id).update({
					data: {
						winnerCount,
					},
				});

				console.log("自动开奖成功:", lottery._id);

				results.push({
					lotteryId: lottery._id,
					title: lottery.title,
					status: 1,
					winnerCount,
					message: "自动开奖成功",
				});
			} catch (error) {
				console.error(`处理抽奖活动 ${lottery._id} 失败:`, error);
				results.push({
					lotteryId: lottery._id,
					title: lottery.title,
					status: "error",
					message: `处理失败: ${error.message}`,
				});
			}
		}

		return {
			success: true,
			message: `成功处理 ${results.length} 个抽奖活动`,
			results,
		};
	} catch (error) {
		console.error("自动开奖执行失败", error);
		return {
			success: false,
			message: "自动开奖执行失败: " + error.message,
			error: error.message,
		};
	}
};
