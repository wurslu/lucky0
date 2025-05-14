// cloud/functions/getLotteryDetail/index.js - 修复版，统一使用_openid
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
				// 使用内部函数标准化时间
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
		if (lottery.creatorId) {
			creatorResult = await userCollection
				.where({
					_openid: lottery.creatorId,
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

		// 查询参与者详细信息 - 统一使用_openid
		const participantOpenIds = participants.map((p) => p._openid);

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

		// 判断抽奖是否已结束 - 使用时间工具函数
		const isEnded = isTimeExpired(lottery.endTimeLocal || lottery.endTime);

		// 获取中奖者信息
		let winners = [];

		if (lottery.hasDrawn && participantsWithUser.length > 0) {
			// 直接查询中奖者记录
			const winnersResult = await participantCollection
				.where({
					lotteryId: id,
					isWinner: true,
				})
				.get();

			if (winnersResult.data && winnersResult.data.length > 0) {
				console.log("找到中奖者记录:", winnersResult.data.length);

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
			} else {
				console.log("通过查询未找到中奖者记录");
			}
		}

		// 即使没有中奖者记录，也尝试从参与者中筛选isWinner为true的记录
		if (winners.length === 0 && lottery.hasDrawn) {
			winners = participantsWithUser.filter((p) => p.isWinner === true);
			console.log("从参与者中筛选出的中奖者:", winners.length);
		}

		// 更新抽奖记录中的实际中奖人数
		if (lottery.hasDrawn && lottery.winnerCount !== winners.length) {
			console.log(`更新中奖人数: ${lottery.winnerCount} -> ${winners.length}`);

			try {
				await lotteryCollection.doc(id).update({
					data: {
						winnerCount: winners.length,
					},
				});
			} catch (error) {
				console.error("更新中奖人数失败:", error);
			}
		}

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
