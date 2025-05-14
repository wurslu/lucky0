// cloud/functions/testDrawSpecificLottery/index.js
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

// 随机选择函数
function getRandomItems(array, count) {
	const shuffled = [...array].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, Math.min(count, array.length));
}

// 主函数 - 指定ID开奖
exports.main = async (event, context) => {
	const { lotteryId } = event;

	if (!lotteryId) {
		return {
			success: false,
			message: "未提供抽奖ID",
		};
	}

	try {
		console.log(`开始测试对特定抽奖进行开奖，ID: ${lotteryId}`);

		// 查询抽奖信息
		const lotteryResult = await lotteryCollection.doc(lotteryId).get();

		if (!lotteryResult.data) {
			return {
				success: false,
				message: "未找到抽奖信息",
			};
		}

		const lottery = lotteryResult.data;
		console.log("获取到抽奖信息:", lottery);

		// 查询是否已有中奖者
		const winnerResult = await participantCollection
			.where({
				lotteryId: lotteryId,
				isWinner: true,
			})
			.count();

		if (winnerResult.total > 0) {
			return {
				success: false,
				message: "该抽奖已有中奖者，无法重复开奖",
			};
		}

		// 查询所有参与者
		const participantsResult = await participantCollection
			.where({
				lotteryId: lotteryId,
			})
			.get();

		const participants = participantsResult.data;
		console.log(`参与者数量: ${participants.length}`);

		if (participants.length === 0) {
			return {
				success: false,
				message: "无人参与，无法开奖",
			};
		}

		// 确定中奖人数
		const winnerCount = Math.min(lottery.prizeCount || 1, participants.length);

		// 随机选取中奖者
		const winners = getRandomItems(participants, winnerCount);
		const winnerIds = winners.map((w) => w._id);

		// 使用事务更新
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

				console.log(`已更新 ${winnerIds.length} 个中奖者状态`);
			}

			// 更新抽奖记录
			await transaction
				.collection("lotteries")
				.doc(lotteryId)
				.update({
					data: {
						winnerCount: winnerCount,
						updateTime: db.serverDate(),
					},
				});

			// 提交事务
			await transaction.commit();

			return {
				success: true,
				message: "测试开奖成功",
				data: {
					winnerCount,
					winnerIds,
				},
			};
		} catch (error) {
			// 事务失败，回滚
			await transaction.rollback();
			console.error("测试开奖事务失败:", error);

			return {
				success: false,
				message: "测试开奖事务失败: " + (error.message || "未知错误"),
				error,
			};
		}
	} catch (error) {
		console.error("测试开奖失败:", error);

		return {
			success: false,
			message: "测试开奖失败: " + (error.message || "未知错误"),
			error,
		};
	}
};
