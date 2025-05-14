// cloud/functions/getWinners/index.js
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const participantCollection = db.collection("participants");
const userCollection = db.collection("users");

exports.main = async (event, context) => {
	const { lotteryId } = event;

	if (!lotteryId) {
		return {
			success: false,
			message: "抽奖ID不能为空",
		};
	}

	try {
		// 直接查询所有中奖者
		const winnersResult = await participantCollection
			.where({
				lotteryId,
				isWinner: true,
			})
			.get();

		if (!winnersResult.data || winnersResult.data.length === 0) {
			return {
				success: true,
				message: "未找到中奖者",
				data: [],
			};
		}

		// 获取中奖者的openid列表
		const winnerOpenIds = winnersResult.data.map((w) => w.openid);

		// 查询中奖用户信息
		let userInfos = [];
		if (winnerOpenIds.length > 0) {
			// 构建查询条件 - 兼容两种字段
			const userQueries = [];
			for (const openId of winnerOpenIds) {
				userQueries.push({ _openid: openId });
				userQueries.push({ openid: openId });
			}

			const userResult = await userCollection
				.where({
					_or: userQueries,
				})
				.get();

			userInfos = userResult.data || [];
		}

		// 合并中奖者信息
		const winners = winnersResult.data.map((winner) => {
			// 查找匹配的用户信息
			const userInfo = userInfos.find(
				(user) =>
					user._openid === winner.openid || user.openid === winner.openid
			);

			if (userInfo) {
				return {
					...winner,
					nickName: userInfo.nickName,
					avatarUrl: userInfo.avatarUrl,
				};
			}

			return winner;
		});

		return {
			success: true,
			message: "获取中奖者成功",
			data: winners,
		};
	} catch (error) {
		console.error("获取中奖者失败:", error);
		return {
			success: false,
			message: "获取中奖者失败: " + error.message,
			error,
		};
	}
};
