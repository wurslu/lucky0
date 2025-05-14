// cloud/functions/autoDrawLottery/index.js - 完整优化版
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

/**
 * 标准化时间字符串，处理可能的时区问题
 * @param {string} timeStr 时间字符串
 * @returns {string} 标准化后的时间字符串
 */
function normalizeTimeString(timeStr) {
	if (!timeStr) return "";

	try {
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

/**
 * 判断时间是否已过期
 * @param {string|Date} timeStr 时间字符串或Date对象
 * @returns {boolean} 是否已过期
 */
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

		// 获取所有抽奖，然后在程序中过滤已结束的
		const lotteryResult = await lotteryCollection.get();

		// 在程序中判断是否已结束，避免数据库查询的时区问题
		const lotteries = lotteryResult.data.filter((lottery) => {
			const endTimeStr = lottery.endTimeLocal || lottery.endTime;
			const isEnded = isTimeExpired(endTimeStr);

			if (isEnded) {
				console.log(
					`抽奖 ${lottery._id} (${lottery.title}) 已结束，结束时间: ${endTimeStr}`
				);
			}

			return isEnded;
		});

		console.log(`找到 ${lotteries.length} 个已结束的抽奖活动`);

		if (lotteries.length === 0) {
			return {
				success: true,
				message: "没有需要自动开奖的活动",
			};
		}

		// 处理每个需要开奖的活动
		const results = [];
		let successCount = 0;

		for (const lottery of lotteries) {
			try {
				console.log(`处理抽奖: ID=${lottery._id}, 标题="${lottery.title}"`);
				console.log(`结束时间: ${lottery.endTimeLocal || lottery.endTime}`);

				// 检查是否已经有中奖者（已经开过奖）
				const alreadyDrawn = await hasWinners(lottery._id);

				// 新增检查：是否已经标记为无人参与但已开奖
				const lotteryDetail = await lotteryCollection.doc(lottery._id).get();
				const isAlreadyProcessed =
					alreadyDrawn ||
					(lotteryDetail.data.hasDrawn === true &&
						lotteryDetail.data.noParticipants === true);

				if (isAlreadyProcessed) {
					console.log(`抽奖 ${lottery._id} 已处理，跳过处理`);
					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						message: "已处理，跳过",
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
					// 无人参与情况处理 - 标记为已开奖但无中奖者
					await lotteryCollection.doc(lottery._id).update({
						data: {
							winnerCount: 0,
							hasDrawn: true,
							noParticipants: true,
							drawTime: db.serverDate(), // 添加开奖时间
							updateTime: db.serverDate(),
						},
					});

					console.log(`抽奖 ${lottery._id} 无人参与，已标记为已开奖`);
					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						message: "已自动开奖，但无人参与",
					});
					successCount++;
					continue;
				}

				// 确定中奖人数（不超过参与人数和设置的奖品数量）
				const winnerCount = Math.min(
					lottery.prizeCount || 1,
					participants.length
				);
				console.log(`设置中奖人数: ${winnerCount}`);

				// 随机选取中奖者
				const winners = getRandomItems(participants, winnerCount);
				const winnerIds = winners.map((w) => w._id);
				console.log(`选取的中奖者ID: ${JSON.stringify(winnerIds)}`);

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

					// 设置中奖人数和抽奖状态
					await transaction
						.collection("lotteries")
						.doc(lottery._id)
						.update({
							data: {
								winnerCount: winnerCount,
								hasDrawn: true,
								noParticipants: false,
								drawTime: db.serverDate(), // 添加开奖时间
								updateTime: db.serverDate(),
							},
						});

					// 提交事务
					await transaction.commit();
					console.log(`抽奖 ${lottery._id} 自动开奖成功`);
					successCount++;

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
						message: `开奖事务失败: ${txError.message || "未知错误"}`,
					});
				}
			} catch (lotteryError) {
				console.error(`处理抽奖 ${lottery._id} 时出错:`, lotteryError);
				results.push({
					lotteryId: lottery._id,
					title: lottery.title || "未知抽奖",
					message: `处理失败: ${lotteryError.message || "未知错误"}`,
				});
			}
		}

		return {
			success: true,
			message: `处理了 ${results.length} 个抽奖活动，成功 ${successCount} 个`,
			results: results,
		};
	} catch (error) {
		console.error("自动开奖函数执行失败:", error);
		return {
			success: false,
			message: "自动开奖执行失败: " + (error.message || "未知错误"),
			error: error,
		};
	}
};
