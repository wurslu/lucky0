// cloud/functions/autoDrawLottery/index.js - 完全修复版
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

/**
 * 标准化时间字符串，处理可能的时区问题
 * @param {string} timeStr 时间字符串
 * @returns {string} 标准化后的时间字符串
 */
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

// 自动开奖主函数
exports.main = async (event, context) => {
	console.log("开始运行自动开奖函数...");
	const now = new Date();
	const results = [];

	try {
		// 查询所有已过期但未开奖的抽奖
		const endedLotteries = await lotteryCollection
			.where({
				endTime: _.lte(now),
				hasDrawn: _.or(_.eq(false), _.exists(false)),
			})
			.limit(20) // 每次最多处理20个抽奖
			.get();

		console.log(`找到 ${endedLotteries.data.length} 个需要开奖的抽奖活动`);

		// 如果没有需要开奖的抽奖
		if (endedLotteries.data.length === 0) {
			return {
				success: true,
				message: "无需要开奖的抽奖",
				results: [],
			};
		}

		// 处理每个已结束的抽奖
		for (const lottery of endedLotteries.data) {
			console.log(`处理抽奖ID: ${lottery._id}, 标题: ${lottery.title}`);

			try {
				// 获取该抽奖的所有参与者
				const participantsResult = await participantCollection
					.where({
						lotteryId: lottery._id,
					})
					.get();

				const participants = participantsResult.data;
				console.log(`抽奖 ${lottery._id} 有 ${participants.length} 个参与者`);

				let resultItem = {
					lotteryId: lottery._id,
					title: lottery.title,
					success: true,
				};

				// 处理无人参与情况
				if (participants.length === 0) {
					console.log(`抽奖 ${lottery._id} 无人参与`);

					// 标记抽奖已开奖但无人参与
					await lotteryCollection.doc(lottery._id).update({
						data: {
							hasDrawn: true,
							noParticipants: true,
							winnerCount: 0,
							drawTime: db.serverDate(),
							updateTime: db.serverDate(),
						},
					});

					resultItem.message = "已自动开奖，无人参与";
					resultItem.winnerCount = 0;
					resultItem.noParticipants = true;
				} else {
					// 有人参与情况下进行开奖
					console.log(`抽奖 ${lottery._id} 开始抽取中奖者`);

					// 确定中奖人数（不超过参与人数和设置的奖品数量）
					const winnerCount = Math.min(
						lottery.prizeCount || 1,
						participants.length
					);

					// 随机选取中奖者
					const winners = getRandomItems(participants, winnerCount);
					const winnerIds = winners.map((w) => w._id);

					console.log(`抽奖 ${lottery._id} 选出 ${winnerIds.length} 个中奖者`);

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
						}

						// 更新抽奖状态
						await transaction
							.collection("lotteries")
							.doc(lottery._id)
							.update({
								data: {
									hasDrawn: true,
									noParticipants: false,
									winnerCount: winnerCount,
									drawTime: db.serverDate(),
									updateTime: db.serverDate(),
								},
							});

						// 提交事务
						await transaction.commit();

						resultItem.message = `已自动开奖，选出 ${winnerCount} 个中奖者`;
						resultItem.winnerCount = winnerCount;
						resultItem.noParticipants = false;

						console.log(`抽奖 ${lottery._id} 开奖成功`);
					} catch (error) {
						// 事务失败，回滚
						await transaction.rollback();
						throw error;
					}
				}

				results.push(resultItem);
			} catch (error) {
				console.error(`处理抽奖 ${lottery._id} 时出错:`, error);
				results.push({
					lotteryId: lottery._id,
					title: lottery.title,
					success: false,
					message: `开奖失败: ${error.message || "未知错误"}`,
				});
			}
		}

		return {
			success: true,
			message: `已处理 ${results.length} 个抽奖活动`,
			results: results,
		};
	} catch (error) {
		console.error("自动开奖执行失败:", error);
		return {
			success: false,
			message: `自动开奖执行失败: ${error.message || "未知错误"}`,
			error: error.message,
			results: results,
		};
	}
};
