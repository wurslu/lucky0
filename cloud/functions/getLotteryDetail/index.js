// cloud/functions/getLotteryDetail/index.js (修复版)
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");
const userCollection = db.collection("users");
const participantCollection = db.collection("participants");

// 简化的时间处理函数
const formatTime = (time) => {
	if (!time) return "";
	try {
		let timeStr = time;
		if (time instanceof Date) {
			timeStr = time.toISOString();
		}
		return typeof timeStr === "string" ? timeStr.replace("Z", "") : "";
	} catch (error) {
		console.error("格式化时间出错:", error);
		return "";
	}
};

const isExpired = (time) => {
	if (!time) return false;
	try {
		const targetTime = new Date(formatTime(time));
		return new Date() >= targetTime;
	} catch (error) {
		console.error("判断过期出错:", error);
		return false;
	}
};

// 主函数
exports.main = async (event, context) => {
	const { id } = event;
	console.log("获取抽奖详情，ID:", id);

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
		console.log("抽奖原始信息:", lottery);

		// 查询创建者信息 - 统一使用_openid
		let creatorResult = null;
		if (lottery._openid) {
			creatorResult = await userCollection
				.where({
					_openid: lottery._openid,
				})
				.get();
		}

		const creator =
			creatorResult && creatorResult.data.length > 0
				? creatorResult.data[0]
				: null;

		console.log("创建者信息:", creator);

		// 查询参与者
		const participantsResult = await participantCollection
			.where({
				lotteryId: id,
			})
			.get();

		const participants = participantsResult.data;
		console.log("参与者数量:", participants.length);

		// 处理无人参与且已开奖的情况
		if (
			lottery.hasDrawn &&
			(lottery.noParticipants || participants.length === 0)
		) {
			console.log("抽奖已开奖但无人参与");
			// 确保noParticipants标记正确
			if (participants.length === 0 && !lottery.noParticipants) {
				await lotteryCollection.doc(id).update({
					data: {
						noParticipants: true,
					},
				});
			}

			return {
				success: true,
				data: {
					...lottery,
					creator,
					participants: [],
					winners: [],
					isEnded: true,
					noParticipants: true,
				},
			};
		}

		// 查询参与者详细信息 - 统一使用_openid
		const participantOpenIds = participants
			.map((p) => p._openid)
			.filter((id) => id);
		console.log("参与者openid列表:", participantOpenIds);

		let participantUsers = [];
		if (participantOpenIds.length > 0) {
			const userResult = await userCollection
				.where({
					_openid: _.in(participantOpenIds),
				})
				.get();

			participantUsers = userResult.data;
			console.log("获取到参与者用户信息:", participantUsers.length);
		}

		// 映射参与者信息
		const participantMap = {};
		participantUsers.forEach((user) => {
			if (user._openid) {
				participantMap[user._openid] = user;
			}
		});

		// 组合详细参与者数据
		const participantsWithUser = participants.map((participant) => {
			const participantInfo = participantMap[participant._openid] || {};
			return {
				...participant,
				...participantInfo,
			};
		});

		// 判断抽奖是否已结束
		const isEnded = isExpired(lottery.endTime);
		console.log("抽奖是否已结束:", isEnded);

		// 获取中奖者信息
		console.log("开始查询中奖者，数据库中的标记:");
		console.log("hasDrawn:", lottery.hasDrawn);
		console.log("参与者总数:", participants.length);

		// 查询中奖者记录
		const winnersResult = await participantCollection
			.where({
				lotteryId: id,
				isWinner: true,
			})
			.get();

		console.log("中奖者查询结果:", winnersResult);
		console.log(
			"找到中奖记录数:",
			winnersResult.data ? winnersResult.data.length : 0
		);

		let winners = [];

		// 处理中奖者数据
		if (winnersResult.data && winnersResult.data.length > 0) {
			console.log("找到中奖者记录:", winnersResult.data.length);

			// 将找到的中奖者与用户信息合并
			winners = winnersResult.data.map((winnerData) => {
				const userInfo = participantMap[winnerData._openid] || {};
				return {
					...winnerData,
					...userInfo,
				};
			});

			console.log("处理后的中奖者:", winners.length);

			// 如果有中奖者但hasDrawn为false，修正hasDrawn状态
			if (!lottery.hasDrawn && isEnded) {
				console.log("检测到中奖者但hasDrawn为false，修正状态");
				try {
					await lotteryCollection.doc(id).update({
						data: {
							hasDrawn: true,
							winnerCount: winners.length,
							updateTime: db.serverDate(),
						},
					});
					// 更新本地对象
					lottery.hasDrawn = true;
					lottery.winnerCount = winners.length;
				} catch (error) {
					console.error("更新hasDrawn状态失败:", error);
				}
			}
		}
		// 修复数据不一致问题
		else if (
			isEnded &&
			lottery.hasDrawn &&
			!lottery.noParticipants &&
			participants.length > 0
		) {
			console.log("检测到时间已过且hasDrawn=true但没有找到中奖者，尝试修复");

			try {
				// 随机选择中奖者
				const winnerCount = Math.min(
					lottery.prizeCount || 1,
					participants.length
				);
				const selectedParticipants = participants
					.sort(() => 0.5 - Math.random())
					.slice(0, winnerCount);

				console.log("修复选择的中奖者:", selectedParticipants.length);

				// 更新中奖状态
				for (const winner of selectedParticipants) {
					await participantCollection.doc(winner._id).update({
						data: {
							isWinner: true,
							updateTime: db.serverDate(),
						},
					});
				}

				// 将选中的参与者作为中奖者返回
				winners = selectedParticipants.map((winner) => {
					const userInfo = participantMap[winner._openid] || {};
					return {
						...winner,
						...userInfo,
						isWinner: true,
					};
				});

				console.log("已修复中奖者:", winners.length);
			} catch (error) {
				console.error("修复中奖者失败:", error);
			}
		}

		// 更新抽奖记录中的实际中奖人数
		if (
			lottery.hasDrawn &&
			lottery.winnerCount !== winners.length &&
			winners.length > 0
		) {
			console.log(`更新中奖人数: ${lottery.winnerCount} -> ${winners.length}`);

			try {
				await lotteryCollection.doc(id).update({
					data: {
						winnerCount: winners.length,
						updateTime: db.serverDate(),
					},
				});

				lottery.winnerCount = winners.length;
			} catch (error) {
				console.error("更新中奖人数失败:", error);
			}
		}

		// 返回最终结果
		console.log("最终返回数据状态:");
		console.log("hasDrawn:", lottery.hasDrawn);
		console.log("isEnded:", isEnded);
		console.log("winners数量:", winners.length);

		return {
			success: true,
			data: {
				...lottery,
				creator,
				participants: participantsWithUser,
				winners,
				isEnded, // 明确的结束标志
			},
		};
	} catch (error) {
		console.error("获取抽奖详情失败", error);
		return {
			success: false,
			message: "获取抽奖详情失败: " + (error.message || "未知错误"),
			error: error.message,
		};
	}
};
