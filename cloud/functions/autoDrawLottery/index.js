// cloud/functions/autoDrawLottery/index.js - 优化的自动开奖功能
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

// 检查是否已有中奖者
async function hasWinners(lotteryId) {
	try {
		// 查询是否已有中奖者
		const result = await participantCollection
			.where({
				lotteryId: lotteryId,
				isWinner: true,
			})
			.count();

		return result.total > 0;
	} catch (error) {
		console.error(`检查是否有中奖者时出错 (${lotteryId}):`, error);
		return false;
	}
}

// 主函数
exports.main = async (event, context) => {
	try {
		const now = new Date();
		console.log("自动开奖函数执行，当前时间:", now.toISOString());

		// 查找所有已过期的抽奖 - 通过时间判断
		const lotteryResult = await lotteryCollection
			.where({
				endTime: _.lte(now), // 结束时间早于或等于当前时间
			})
			.get();

		const lotteries = lotteryResult.data;
		console.log(`找到 ${lotteries.length} 个需要检查的抽奖活动`);

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
				console.log(`处理抽奖: ID=${lottery._id}, 标题="${lottery.title}"`);

				// 检查是否已经有中奖者（已经开过奖）
				const alreadyDrawn = await hasWinners(lottery._id);
				if (alreadyDrawn) {
					console.log(`抽奖 ${lottery._id} 已经开过奖，跳过处理`);
					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						message: "已经开过奖，跳过处理",
					});
					continue;
				}

				// 查询所有参与者
				const participantsResult = await participantCollection
					.where({
						lotteryId: lottery._id,
					})
					.get();

				const participants = participantsResult.data;
				console.log(`参与者数量: ${participants.length}`);

				if (participants.length === 0) {
					// 无人参与，记录日志
					console.log(`抽奖 ${lottery._id} 无人参与`);
					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						message: "无人参与，无法开奖",
					});
					continue;
				}

				// 确定中奖人数（不超过参与人数和设置的奖品数量）
				const winnerCount = Math.min(
					lottery.prizeCount || 1,
					participants.length
				);
				console.log(`中奖人数: ${winnerCount}`);

				// 随机选取中奖者
				const winners = getRandomItems(participants, winnerCount);
				const winnerIds = winners.map((w) => w._id);
				console.log(`选取的中奖者: ${winnerIds.length}个`);

				// 使用事务确保原子性操作
				const transaction = await db.startTransaction();

				try {
					// 更新中奖者状态
					if (winnerIds.length > 0) {
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

						console.log(`已更新 ${winnerIds.length} 个中奖者状态`);
					}

					// 设置中奖人数
					await transaction
						.collection("lotteries")
						.doc(lottery._id)
						.update({
							data: {
								winnerCount: winnerCount,
								updateTime: db.serverDate(),
							},
						});

					// 提交事务
					await transaction.commit();
					console.log(`抽奖 ${lottery._id} 自动开奖成功`);

					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						winnerCount: winnerCount,
						message: "自动开奖成功",
					});
				} catch (txError) {
					// 事务失败，回滚
					await transaction.rollback();
					console.error(`抽奖 ${lottery._id} 事务失败:`, txError);

					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						message: `开奖事务失败: ${txError.message}`,
					});
				}
			} catch (lotteryError) {
				console.error(`处理抽奖 ${lottery._id} 时出错:`, lotteryError);
				results.push({
					lotteryId: lottery._id,
					title: lottery.title || "未知抽奖",
					message: `处理失败: ${lotteryError.message}`,
				});
			}
		}

		return {
			success: true,
			message: `处理了 ${results.length} 个抽奖活动`,
			results: results,
		};
	} catch (error) {
		console.error("自动开奖函数执行失败:", error);
		return {
			success: false,
			message: "自动开奖执行失败: " + error.message,
			error: error.message,
		};
	}
};
