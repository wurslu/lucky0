// cloud/functions/autoDrawLottery/index.js (完整修改版)
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

// 统一的时间处理函数
function formatTime(time) {
	if (!time) return "";
	try {
		// 处理Date对象
		if (time instanceof Date) {
			return time.toISOString().replace("Z", "");
		}
		// 处理字符串
		if (typeof time === "string") {
			return time.replace("Z", "");
		}
		return String(time);
	} catch (error) {
		console.error("格式化时间出错:", error);
		return "";
	}
}

// 判断时间是否已过期
function isExpired(time) {
	if (!time) return false;
	try {
		const formattedTime = formatTime(time);
		const targetTime = new Date(formattedTime);
		const now = new Date();

		if (isNaN(targetTime.getTime())) {
			console.error("无效的时间:", time);
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

// 自动开奖主函数
exports.main = async (event, context) => {
	console.log("开始运行自动开奖函数...");
	const now = new Date();
	const results = [];

	try {
		// 改进的查询逻辑：先获取所有未开奖的抽奖
		const pendingLotteries = await lotteryCollection
			.where({
				hasDrawn: _.or(_.eq(false), _.exists(false)),
			})
			.limit(20) // 每次最多处理20个抽奖
			.get();

		// 手动过滤出已过期的抽奖
		const endedLotteries = {
			data: pendingLotteries.data.filter((lottery) => {
				// 使用统一的时间格式化函数判断是否过期
				return isExpired(lottery.endTime);
			}),
		};

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
			console.log(`抽奖结束时间: ${formatTime(lottery.endTime)}`);

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

					try {
						// 使用事务处理开奖操作
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

							// 尝试直接更新
							console.log(`事务开奖失败，尝试直接更新: ${error.message}`);

							// 更新中奖者状态
							if (winnerIds.length > 0) {
								for (const winnerId of winnerIds) {
									await participantCollection.doc(winnerId).update({
										data: {
											isWinner: true,
											updateTime: db.serverDate(),
										},
									});
								}
							}

							// 更新抽奖状态
							await lotteryCollection.doc(lottery._id).update({
								data: {
									hasDrawn: true,
									noParticipants: false,
									winnerCount: winnerCount,
									drawTime: db.serverDate(),
									updateTime: db.serverDate(),
								},
							});

							resultItem.message = `已直接更新开奖，选出 ${winnerCount} 个中奖者`;
							resultItem.winnerCount = winnerCount;
							resultItem.noParticipants = false;
							resultItem.transactionFailed = true;

							console.log(`抽奖 ${lottery._id} 直接更新成功`);
						}
					} catch (error) {
						// 如果事务和直接更新都失败了
						console.error(`抽奖 ${lottery._id} 开奖操作完全失败:`, error);
						throw new Error(`开奖操作失败: ${error.message}`);
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
