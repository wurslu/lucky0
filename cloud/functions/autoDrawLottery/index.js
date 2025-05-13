// cloud/functions/autoDrawLottery/index.js
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

		// 查询所有已到开奖时间但未开奖的抽奖活动
		const lotteryResult = await lotteryCollection
			.where({
				status: "active",
				endTime: _.lte(now),
			})
			.get();

		const lotteries = lotteryResult.data;

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
				// 查询所有参与者
				const participantsResult = await participantCollection
					.where({
						lotteryId: lottery._id,
					})
					.get();

				const participants = participantsResult.data;

				if (participants.length === 0) {
					// 无人参与，直接标记为已结束
					await lotteryCollection.doc(lottery._id).update({
						data: {
							status: "completed",
							updateTime: db.serverDate(),
							winnerCount: 0,
						},
					});

					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						status: "completed",
						message: "无人参与，已结束",
					});

					continue;
				}

				// 确定中奖人数（不超过参与人数和设置的奖品数量）
				const winnerCount = Math.min(lottery.prizeCount, participants.length);

				// 随机选取中奖者
				const winners = getRandomItems(participants, winnerCount);
				const winnerIds = winners.map((w) => w._id);

				const transaction = await db.startTransaction();

				try {
					// 1. 更新抽奖状态为已结束
					await transaction
						.collection("lotteries")
						.doc(lottery._id)
						.update({
							data: {
								status: "completed",
								updateTime: db.serverDate(),
								winnerCount,
							},
						});

					// 2. 更新中奖者状态
					await transaction
						.collection("participants")
						.where({
							_id: _.in(winnerIds),
						})
						.update({
							data: {
								isWinner: true,
								updateTime: db.serverDate(),
							},
						});

					// 提交事务
					await transaction.commit();

					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						status: "completed",
						winnerCount,
						message: "自动开奖成功",
					});
				} catch (error) {
					// 事务失败，回滚
					await transaction.rollback();
					throw error;
				}
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
			message: "自动开奖执行失败",
			error,
		};
	}
};

// 云函数触发器配置：
// {
//   "config": {
//     "triggers": [
//       {
//         "name": "myTrigger",
//         "type": "timer",
//         "config": "0 */5 * * * * *"  // 每5分钟触发一次
//       }
//     ]
//   }
// }
