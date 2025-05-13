// cloud/functions/getLotteryDetail/index.js (完整修改版)
// 云函数：获取抽奖详情

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

		// 如果状态是字符串格式，转换为数字格式
		if (typeof lottery.status === "string") {
			if (lottery.status === "active") {
				lottery.status = 0;

				// 自动更新数据库中的状态为数字格式
				await lotteryCollection.doc(id).update({
					data: {
						status: 0,
					},
				});
				console.log("已自动修正状态格式: 'active' -> 0");
			} else if (lottery.status === "completed") {
				lottery.status = 1;

				// 自动更新数据库中的状态为数字格式
				await lotteryCollection.doc(id).update({
					data: {
						status: 1,
					},
				});
				console.log("已自动修正状态格式: 'completed' -> 1");
			}
		}

		// 检查是否需要自动更新状态（如果已过期但状态仍为进行中）
		if (lottery.status === 0) {
			const endTime = new Date(lottery.endTime);
			const now = new Date();

			console.log("当前时间:", now.toISOString());
			console.log("开奖时间:", endTime.toISOString());
			console.log("是否已过期:", now > endTime);

			if (now > endTime) {
				console.log("时间已过，自动更新状态为已结束");

				// 更新状态为已结束
				await lotteryCollection.doc(id).update({
					data: {
						status: 1, // 统一使用数字 1 表示已结束
						updateTime: db.serverDate(),
					},
				});

				// 更新返回的数据对象
				lottery.status = 1;
			}
		}

		// 处理时区问题 - 如果没有本地时间，创建一个
		if (!lottery.endTimeLocal && lottery.endTime) {
			const endTime = new Date(lottery.endTime);
			lottery.endTimeLocal = endTime.toISOString();

			console.log("添加本地结束时间:", lottery.endTimeLocal);

			// 更新数据库中的记录
			lotteryCollection
				.doc(id)
				.update({
					data: {
						endTimeLocal: lottery.endTimeLocal,
					},
				})
				.then(() => {
					console.log("本地时间添加成功");
				})
				.catch((err) => {
					console.error("本地时间添加失败:", err);
				});
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

		// 获取中奖者信息
		let winners = [];
		if (lottery.status === 1 && participantsWithUser.length > 0) {
			winners = participantsWithUser.filter((p) => p.isWinner);
			console.log("中奖者数量:", winners.length);
		}

		return {
			success: true,
			data: {
				...lottery,
				creator,
				participants: participantsWithUser,
				winners,
			},
		};
	} catch (error) {
		console.error("获取抽奖详情失败", error);
		return {
			success: false,
			message: "获取抽奖详情失败: " + error.message,
			error: error.message,
		};
	}
};
