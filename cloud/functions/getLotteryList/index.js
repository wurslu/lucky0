// cloud/functions/getLotteryList/index.js (简化版)
// 云函数：获取抽奖列表

const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

// 获取数据库引用
const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");

// 主函数
exports.main = async (event, context) => {
	console.log("getLotteryList函数被调用，参数:", event);
	const { page = 1, limit = 10, status } = event;
	const skip = (page - 1) * limit;

	try {
		// 构建查询条件
		let query = lotteryCollection;

		// 如果指定了状态，则按状态过滤 - 只使用数字状态
		if (status !== undefined) {
			// 确保状态为数字类型
			const numStatus = typeof status === "string" ? parseInt(status) : status;
			query = query.where({
				status: numStatus,
			});
		}

		// 尝试获取总数
		const countResult = await query.count();

		// 查询列表
		const listResult = await query
			.orderBy("createTime", "desc")
			.skip(skip)
			.limit(limit)
			.get();

		// 获取创建者信息
		const lotteries = listResult.data;
		let lotteriesWithCreator = lotteries;

		if (lotteries.length > 0) {
			const creatorIds = [
				...new Set(
					lotteriesWithCreator
						.map((lottery) => lottery.creatorId)
						.filter((id) => id)
				),
			];

			// 批量查询创建者信息
			let creators = [];
			if (creatorIds.length > 0) {
				try {
					const creatorsResult = await db
						.collection("users")
						.where({
							_openid: _.in(creatorIds),
						})
						.get();
					creators = creatorsResult.data;
				} catch (error) {
					console.error("查询创建者信息失败:", error);
				}
			}

			// 创建创建者信息映射
			const creatorsMap = {};
			creators.forEach((creator) => {
				creatorsMap[creator._openid] = creator;
			});

			// 组合数据
			lotteriesWithCreator = lotteriesWithCreator.map((lottery) => {
				const result = { ...lottery };
				if (lottery.creatorId && creatorsMap[lottery.creatorId]) {
					result.creator = creatorsMap[lottery.creatorId];
				}
				return result;
			});
		}

		return {
			success: true,
			data: {
				lotteries: lotteriesWithCreator,
				total: countResult.total,
				page,
				limit,
			},
		};
	} catch (error) {
		// 如果是集合不存在错误，则返回空列表
		if (
			error.errCode === -502005 ||
			error.message?.includes("COLLECTION_NOT_EXIST")
		) {
			console.log("lotteries集合可能不存在，返回空列表");
			return {
				success: true,
				data: {
					lotteries: [],
					total: 0,
					page,
					limit,
				},
			};
		}

		console.error("获取抽奖列表失败，错误:", error);
		return {
			success: false,
			message: "获取抽奖列表失败: " + (error.message || "未知错误"),
			error: error.message,
		};
	}
};
