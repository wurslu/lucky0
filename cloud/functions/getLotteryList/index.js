// cloud/functions/getLotteryList/index.js - 内联时间工具函数版本
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

// 获取数据库引用
const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");

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

// 主函数
exports.main = async (event, context) => {
	console.log("getLotteryList函数被调用，参数:", event);
	const { page = 1, limit = 10 } = event;
	const skip = (page - 1) * limit;

	try {
		// 查询列表 - 不再使用status过滤，而是通过时间判断
		let query = lotteryCollection;

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

			// 当前时间
			const now = new Date();

			// 组合数据，并添加isEnded标志
			lotteriesWithCreator = lotteriesWithCreator.map((lottery) => {
				// 判断是否已结束 - 使用内联函数判断
				let isEnded = false;
				try {
					isEnded = isTimeExpired(lottery.endTimeLocal || lottery.endTime);
					console.log(`抽奖ID: ${lottery._id} 是否已结束: ${isEnded}`);
				} catch (error) {
					console.error(`判断抽奖ID: ${lottery._id} 是否结束时出错:`, error);
					console.error("结束时间:", lottery.endTimeLocal || lottery.endTime);
				}

				// 构建返回结果
				const result = {
					...lottery,
					isEnded, // 添加基于时间的结束标志
				};

				// 添加创建者信息
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
