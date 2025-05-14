// cloud/functions/drawLottery/index.js - 移除status依赖的版本
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

	console.log("开奖操作 - 抽奖ID:", id);
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

		// 检查抽奖是否已经结束 - 通过时间判断
		const now = new Date();
		const endTime = new Date(lottery.endTimeLocal || lottery.endTime);
		const isEnded = now >= endTime;

		if (isEnded) {
			// 查询是否已经有中奖者 - 判断是否已经开过奖
			const winnersResult = await participantCollection
				.where({
					lotteryId: id,
					isWinner: true,
				})
				.count();

			if (winnersResult.total > 0) {
				return {
					success: false,
					message: "该抽奖已经开奖，无法重复开奖",
				};
			}
		}

		// 查询当前用户信息，检查是否有权限操作
		// 支持 _openid 和 openid 两种字段
		const userResult = await userCollection
			.where(
				_.or([{ _openid: wxContext.OPENID }, { openid: wxContext.OPENID }])
			)
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

		// 检查是否是创建者或管理员 - 兼容多种字段
		const isCreator =
			lottery.creatorId === wxContext.OPENID ||
			lottery._openid === wxContext.OPENID ||
			lottery.openid === wxContext.OPENID;

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

		if (participants.length === 0) {
			return {
				success: false,
				message: "暂无人参与，无法开奖",
			};
		}

		// 确定中奖人数（不超过参与人数和设置的奖品数量）
		const winnerCount = Math.min(lottery.prizeCount, participants.length);
		console.log("中奖人数:", winnerCount);

		// 随机选取中奖者
		const winners = getRandomItems(participants, winnerCount);

		// 批量更新中奖状态
		const winnerIds = winners.map((w) => w._id);
		console.log("中奖者ID:", winnerIds);

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

			// 记录开奖信息 - 添加winnerCount字段
			await transaction
				.collection("lotteries")
				.doc(id)
				.update({
					data: {
						winnerCount,
						updateTime: db.serverDate(),
					},
				});

			// 提交事务
			await transaction.commit();
			console.log("开奖事务提交成功");

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
			console.error("开奖事务失败，已回滚:", error);
			throw error;
		}
	} catch (error) {
		console.error("开奖失败", error);
		return {
			success: false,
			message: "开奖失败，请重试: " + error.message,
			error: error.message,
		};
	}
};
