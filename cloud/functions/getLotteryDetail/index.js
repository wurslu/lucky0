// cloud/functions/getLotteryDetail/index.js
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

		// 检查是否需要自动更新状态
		// 兼容两种状态格式：数字(0,1)和字符串("active","completed")
		if (lottery.status === 0 || lottery.status === "active") {
			const endTime = new Date(lottery.endTime);
			const now = new Date();

			if (now > endTime) {
				// 时间已过，自动更新状态为已结束
				await lotteryCollection.doc(id).update({
					data: {
						status: 1, // 更新为已结束
						updateTime: db.serverDate(),
					},
				});

				// 更新返回的数据对象
				lottery.status = 1;
			}
		}

		// 查询创建者信息
		const creatorResult = await userCollection
			.where({
				_openid: lottery.creatorId,
			})
			.get();

		const creator =
			creatorResult.data.length > 0 ? creatorResult.data[0] : null;

		// 查询参与者
		const participantsResult = await participantCollection
			.where({
				lotteryId: id,
			})
			.get();

		const participants = participantsResult.data;

		// 查询参与者详细信息
		const participantOpenIds = participants.map((p) => p.openid);

		let participantUsers = [];
		if (participantOpenIds.length > 0) {
			const userResult = await userCollection
				.where({
					_openid: _.in(participantOpenIds),
				})
				.get();

			participantUsers = userResult.data;
		}

		// 映射参与者信息
		const participantMap = {};
		participantUsers.forEach((user) => {
			participantMap[user._openid] = user;
		});

		// 组合数据
		const participantsWithUser = participants.map((participant) => {
			return {
				...participant,
				...participantMap[participant.openid],
			};
		});

		// 获取中奖者信息
		let winners = [];
		// 兼容两种状态格式：数字(0,1)和字符串("active","completed")
		const isCompleted = lottery.status === 1 || lottery.status === "completed";

		if (isCompleted && participantsWithUser.length > 0) {
			winners = participantsWithUser.filter((p) => p.isWinner);
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
			message: "获取抽奖详情失败",
			error: error.message,
		};
	}
};
