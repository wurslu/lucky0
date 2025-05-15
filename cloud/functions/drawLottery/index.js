// cloud/functions/drawLottery/index.js - 使用公共模块版本
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");
const userCollection = db.collection("users");

// 随机选择函数
function getRandomItems(array, count) {
	const shuffled = [...array].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, Math.min(count, array.length));
}

// 主函数
exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();
	const { id } = event;

	console.log("手动开奖操作 - 抽奖ID:", id);
	console.log("当前用户OPENID:", wxContext.OPENID);

	if (!id) {
		return {
			success: false,
			message: "抽奖ID不能为空",
		};
	}

	try {
		// 查询抽奖信息
		const lotteryResult = await lotteryCollection.doc(id).get();

		if (!lotteryResult.data) {
			return {
				success: false,
				message: "未找到抽奖信息",
			};
		}

		const lottery = lotteryResult.data;
		console.log("抽奖信息:", lottery);

		// 检查抽奖是否已经开奖
		if (lottery.hasDrawn) {
			console.log("抽奖已开奖，无法重复开奖");
			return {
				success: false,
				message: "该抽奖已经开奖，无法重复开奖",
			};
		}

		// 查询当前用户信息，检查是否有权限操作
		const userResult = await userCollection
			.where({
				_openid: wxContext.OPENID,
			})
			.get();

		console.log("用户查询结果:", userResult);

		if (userResult.data.length === 0) {
			return {
				success: false,
				message: "用户不存在",
			};
		}

		const user = userResult.data[0];
		console.log("当前用户信息:", user);

		// 检查是否是创建者或管理员
		const isCreator =
			lottery.creatorId === wxContext.OPENID ||
			lottery._openid === wxContext.OPENID;

		if (!isCreator && !user.isAdmin) {
			return {
				success: false,
				message: "您没有权限进行开奖操作",
			};
		}

		// 查询所有参与者
		const participantsResult = await participantCollection
			.where({
				lotteryId: id,
			})
			.get();

		const participants = participantsResult.data;
		console.log("参与者数量:", participants.length);

		// 处理无人参与情况
		if (participants.length === 0) {
			console.log("抽奖无人参与");

			// 标记抽奖已开奖但无人参与
			const updateResult = await lotteryCollection.doc(id).update({
				data: {
					hasDrawn: true,
					noParticipants: true,
					winnerCount: 0,
					drawTime: db.serverDate(),
					updateTime: db.serverDate(),
				},
			});

			console.log("无人参与抽奖更新结果:", updateResult);

			return {
				success: true,
				message: "已开奖，但无人参与",
				data: {
					winnerCount: 0,
					noParticipants: true,
				},
			};
		}

		// 确定中奖人数（不超过参与人数和设置的奖品数量）
		const winnerCount = Math.min(lottery.prizeCount || 1, participants.length);
		console.log("中奖人数:", winnerCount);

		// 随机选取中奖者
		const winners = getRandomItems(participants, winnerCount);
		const winnerIds = winners.map((w) => w._id);
		console.log("中奖者ID:", winnerIds);
		console.log("中奖者详情:", JSON.stringify(winners));

		let updateSuccess = false;
		let detailedWinners = [];

		try {
			// 使用事务处理开奖操作
			const transaction = await db.startTransaction();

			try {
				// 更新中奖者状态
				if (winnerIds.length > 0) {
					for (const winnerId of winnerIds) {
						await transaction
							.collection("participants")
							.doc(winnerId)
							.update({
								data: {
									isWinner: true,
									updateTime: db.serverDate(),
								},
							});

						console.log(`已更新中奖者 ${winnerId} 状态`);
					}
				}

				// 更新抽奖信息
				await transaction
					.collection("lotteries")
					.doc(id)
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
				updateSuccess = true;
				console.log("开奖事务提交成功");
			} catch (error) {
				// 事务失败，回滚
				await transaction.rollback();
				console.error("开奖事务失败，已回滚:", error);
				throw error;
			}
		} catch (error) {
			console.error("事务处理失败，尝试直接更新:", error);

			// 如果事务失败，尝试直接更新
			try {
				// 更新中奖者状态
				if (winnerIds.length > 0) {
					for (const winnerId of winnerIds) {
						await participantCollection.doc(winnerId).update({
							data: {
								isWinner: true,
								updateTime: db.serverDate(),
							},
						});

						console.log(`已直接更新中奖者 ${winnerId} 状态`);
					}
				}

				// 更新抽奖信息
				await lotteryCollection.doc(id).update({
					data: {
						hasDrawn: true,
						noParticipants: false,
						winnerCount: winnerCount,
						drawTime: db.serverDate(),
						updateTime: db.serverDate(),
					},
				});

				updateSuccess = true;
				console.log("直接更新成功");
			} catch (directUpdateError) {
				console.error("直接更新也失败:", directUpdateError);
				throw directUpdateError;
			}
		}

		// 确认更新成功后，查询中奖者详细信息用于返回
		if (updateSuccess) {
			try {
				// 查询每个中奖者的详细信息
				for (const winner of winners) {
					try {
						// 查询用户信息
						const userDetail = await userCollection
							.where({
								_openid: winner._openid,
							})
							.get();

						if (userDetail.data && userDetail.data.length > 0) {
							detailedWinners.push({
								...winner,
								nickName: userDetail.data[0].nickName,
								avatarUrl: userDetail.data[0].avatarUrl,
								isWinner: true,
							});
						} else {
							detailedWinners.push({
								...winner,
								isWinner: true,
							});
						}
					} catch (error) {
						console.error("获取中奖者详情失败:", error);
						// 如果获取详情失败，至少返回原始中奖者信息
						detailedWinners.push({
							...winner,
							isWinner: true,
						});
					}
				}
			} catch (error) {
				console.error("获取中奖者详情失败:", error);
				// 如果获取详情失败，至少返回原始中奖者信息
				detailedWinners = winners.map((w) => ({ ...w, isWinner: true }));
			}
		}

		return {
			success: true,
			message: "开奖成功",
			data: {
				winnerCount,
				winners: detailedWinners,
			},
		};
	} catch (error) {
		console.error("开奖失败", error);
		return {
			success: false,
			message: "开奖失败，请重试: " + error.message,
			error: error.message,
		};
	}
};
