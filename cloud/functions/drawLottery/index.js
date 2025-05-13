// cloud/functions/drawLottery/index.js
// 云函数：开奖

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

		// 检查抽奖状态
		if (lottery.status === "completed") {
			return {
				success: false,
				message: "该抽奖已结束",
			};
		}

		// 查询当前用户信息，检查是否有权限操作
		const userResult = await userCollection
			.where({
				openid: wxContext.OPENID,
			})
			.get();

		if (userResult.data.length === 0) {
			return {
				success: false,
				message: "用户不存在",
			};
		}

		const user = userResult.data[0];

		// 检查是否是创建者或管理员
		if (lottery.creatorId !== wxContext.OPENID && !user.isAdmin) {
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

		if (participants.length === 0) {
			return {
				success: false,
				message: "暂无人参与，无法开奖",
			};
		}

		// 确定中奖人数（不超过参与人数和设置的奖品数量）
		const winnerCount = Math.min(lottery.prizeCount, participants.length);

		// 随机选取中奖者
		const winners = getRandomItems(participants, winnerCount);

		// 批量更新中奖状态
		const winnerIds = winners.map((w) => w._id);

		const transaction = await db.startTransaction();

		try {
			// 1. 更新抽奖状态为已结束
			await transaction
				.collection("lotteries")
				.doc(id)
				.update({
					data: {
						status: "completed",
						updateTime: db.serverDate(),
						winnerCount,
					},
				});

			// 2. 更新中奖者状态
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

			// 提交事务
			await transaction.commit();

			return {
				success: true,
				message: "开奖成功",
				data: {
					winnerCount,
					winners,
				},
			};
		} catch (error) {
			// 事务失败，回滚
			await transaction.rollback();
			throw error;
		}
	} catch (error) {
		console.error("开奖失败", error);
		return {
			success: false,
			message: "开奖失败，请重试",
			error,
		};
	}
};
