// cloud/functions/getLotteryDetail/index.js - 完整优化版
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

		// 查询创建者信息 - 支持多种字段名
		let creatorResult;
		if (lottery.creatorId) {
			creatorResult = await userCollection
				.where(
					_.or([{ _openid: lottery.creatorId }, { openid: lottery.creatorId }])
				)
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

		// 查询参与者详细信息
		const participantOpenIds = participants.map((p) => p.openid);

		let participantUsers = [];
		if (participantOpenIds.length > 0) {
			// 使用 or 条件查询，兼容两种字段名
			const userQueries = [];
			for (const openId of participantOpenIds) {
				userQueries.push({ _openid: openId });
				userQueries.push({ openid: openId });
			}

			const userResult = await userCollection.where(_.or(userQueries)).get();

			participantUsers = userResult.data;
			console.log("获取到参与者用户信息:", participantUsers.length);
		}

		// 映射参与者信息 - 使用 openid 或 _openid 作为映射键
		const participantMap = {};
		participantUsers.forEach((user) => {
			const userKey = user.openid || user._openid;
			if (userKey) {
				participantMap[userKey] = user;
			}
		});

		// 组合数据
		const participantsWithUser = participants.map((participant) => {
			const participantInfo = participantMap[participant.openid] || {};
			return {
				...participant,
				...participantInfo,
			};
		});

		// 判断抽奖是否已结束 - 使用时间工具函数
		const isEnded = isTimeExpired(lottery.endTimeLocal || lottery.endTime);

		// 获取中奖者信息 - 优化版，无需依赖isEnded标志
		let winners = [];
		// 直接查询中奖者 - 使用hasDrawn字段或isWinner条件
		if (participantsWithUser.length > 0) {
			if (lottery.hasDrawn) {
				// 方法1: 直接使用标记为已开奖的记录，查询所有中奖者
				winners = participantsWithUser.filter((p) => p.isWinner);
				console.log("通过isWinner过滤得到中奖者数量:", winners.length);
			}

			// 如果首次过滤没有找到中奖者，尝试通过数据库直接查询
			if (winners.length === 0) {
				try {
					console.log("尝试直接查询中奖者");
					const winnersResult = await participantCollection
						.where({
							lotteryId: id,
							isWinner: true,
						})
						.get();

					if (winnersResult.data && winnersResult.data.length > 0) {
						// 找到中奖者，但可能需要填充用户信息
						const winnerIds = winnersResult.data.map((w) => w._id);
						console.log("通过数据库查询找到中奖者IDs:", winnerIds);

						// 将找到的中奖者与现有用户信息合并
						winners = winnersResult.data.map((winnerData) => {
							// 查找匹配的用户信息
							const participant = participantsWithUser.find(
								(p) => p._id === winnerData._id
							);
							return participant || winnerData; // 如果找到匹配的参与者则使用，否则使用原始数据
						});
					}
				} catch (error) {
					console.error("直接查询中奖者失败:", error);
				}
			}

			console.log("最终获取到的中奖者数量:", winners.length);
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
