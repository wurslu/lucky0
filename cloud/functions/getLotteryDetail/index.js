// cloud/functions/getLotteryDetail/index.js - 内联时间工具函数版本
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

// 内联时间工具函数
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

function getCurrentStandardTime() {
	try {
		const now = new Date();
		return now.toISOString().replace("Z", "");
	} catch (error) {
		console.error("获取当前标准时间出错:", error);
		return new Date().toISOString();
	}
}

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

		// 处理时区问题 - 确保有本地时间格式
		if (!lottery.endTimeLocal && lottery.endTime) {
			try {
				// 使用内联函数标准化时间
				const endTimeNormalized = normalizeTimeString(
					lottery.endTime.toISOString
						? lottery.endTime.toISOString()
						: lottery.endTime
				);
				lottery.endTimeLocal = endTimeNormalized;

				console.log("添加本地结束时间:", lottery.endTimeLocal);

				// 异步更新数据库，但不等待结果
				lotteryCollection
					.doc(id)
					.update({
						data: {
							endTimeLocal: lottery.endTimeLocal,
						},
					})
					.then(() => {
						console.log("成功更新本地时间标记");
					})
					.catch((err) => {
						console.error("更新本地时间标记失败:", err);
					});
			} catch (error) {
				console.error("处理时区时出错:", error);
			}
		}

		// 同样处理开始时间
		if (!lottery.startTimeLocal && lottery.startTime) {
			try {
				const startTimeNormalized = normalizeTimeString(
					lottery.startTime.toISOString
						? lottery.startTime.toISOString()
						: lottery.startTime
				);
				lottery.startTimeLocal = startTimeNormalized;

				// 异步更新，不等待结果
				lotteryCollection
					.doc(id)
					.update({
						data: {
							startTimeLocal: lottery.startTimeLocal,
						},
					})
					.catch((err) => {
						console.error("更新本地开始时间失败:", err);
					});
			} catch (error) {
				console.error("处理开始时间时区时出错:", error);
			}
		}

		// 查询创建者信息 - 统一使用_openid
		let creatorResult;
		if (lottery.creatorId || lottery._openid) {
			creatorResult = await userCollection
				.where({
					_openid: lottery.creatorId || lottery._openid,
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
		if (lottery.hasDrawn && lottery.noParticipants) {
			console.log("抽奖已开奖但无人参与");
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

		// 如果没有参与者但已经标记为已开奖
		if (participants.length === 0 && lottery.hasDrawn) {
			console.log("抽奖已开奖但无人参与 (未显式标记)");

			// 异步更新标记为无人参与
			lotteryCollection
				.doc(id)
				.update({
					data: {
						noParticipants: true,
					},
				})
				.catch((err) => {
					console.error("更新为无人参与状态失败:", err);
				});

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
			// 统一使用_openid字段查询
			const userResult = await userCollection
				.where({
					_openid: _.in(participantOpenIds),
				})
				.get();

			participantUsers = userResult.data;
			console.log("获取到参与者用户信息:", participantUsers.length);
		}

		// 映射参与者信息 - 统一使用_openid
		const participantMap = {};
		participantUsers.forEach((user) => {
			if (user._openid) {
				participantMap[user._openid] = user;
			}
		});

		// 组合数据
		const participantsWithUser = participants.map((participant) => {
			const participantInfo = participantMap[participant._openid] || {};
			return {
				...participant,
				...participantInfo,
			};
		});

		// 判断抽奖是否已结束 - 使用内联函数
		let isEnded = false;
		try {
			isEnded = isTimeExpired(lottery.endTimeLocal || lottery.endTime);
			console.log("抽奖是否已结束:", isEnded);
		} catch (error) {
			console.error("判断抽奖是否结束时出错:", error);
			console.error("结束时间:", lottery.endTimeLocal || lottery.endTime);
		}

		// 获取中奖者信息 - 使用参与者中的isWinner字段
		console.log("开始查询中奖者，数据库中的标记:");
		console.log("hasDrawn:", lottery.hasDrawn);
		console.log("参与者总数:", participants.length);

		// 明确标记搜索中奖者的条件
		let winners = [];

		// 直接查询中奖者记录 - 不管hasDrawn状态，先查看数据库实际情况
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

		// 根据查询结果处理
		if (winnersResult.data && winnersResult.data.length > 0) {
			console.log("找到中奖者记录:", winnersResult.data.length);
			console.log("中奖者原始数据:", JSON.stringify(winnersResult.data));

			// 将找到的中奖者与用户信息合并
			winners = winnersResult.data.map((winnerData) => {
				// 查找匹配的用户信息
				const userInfo = participantMap[winnerData._openid] || {};
				return {
					...winnerData,
					...userInfo,
				};
			});

			console.log("处理后的中奖者:", winners.length);
			console.log("中奖者详情:", JSON.stringify(winners));

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
		// 如果查询不到中奖者，但时间已过且标记为已开奖，尝试补救
		else if (
			isEnded &&
			lottery.hasDrawn &&
			!lottery.noParticipants &&
			lottery.winnerCount > 0
		) {
			console.log(
				"检测到时间已过且hasDrawn=true但没有找到中奖者，尝试重新选择"
			);

			try {
				// 随机选择中奖者
				const winnerCount = Math.min(
					lottery.prizeCount || 1,
					participants.length
				);

				if (participants.length > 0) {
					const selectedParticipants = participants
						.sort(() => 0.5 - Math.random())
						.slice(0, winnerCount);

					console.log("补救选择的中奖者:", selectedParticipants.length);

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

					console.log("已重新选择中奖者:", winners.length);
				}
			} catch (error) {
				console.error("补救中奖者失败:", error);
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

				// 更新本地对象
				lottery.winnerCount = winners.length;
			} catch (error) {
				console.error("更新中奖人数失败:", error);
			}
		}

		// 调试输出最终返回数据
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
				isEnded, // 添加一个明确的标志表示抽奖是否已结束
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
