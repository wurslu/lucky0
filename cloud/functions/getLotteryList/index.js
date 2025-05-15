// cloud/functions/getLotteryList/index.js (修改版)
const cloud = require("wx-server-sdk");

// 初始化云环境
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

// 获取数据库引用
const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");

// 统一的时间处理函数
function formatTime(time) {
	if (!time) return "";
	try {
		// 处理Date对象
		if (time instanceof Date) {
			return time.toISOString().replace("Z", "");
		}
		// 处理字符串
		if (typeof time === "string") {
			return time.replace("Z", "");
		}
		return String(time);
	} catch (error) {
		console.error("格式化时间出错:", error);
		return "";
	}
}

// 判断时间是否已过期
function isExpired(time) {
	if (!time) return false;
	try {
		const formattedTime = formatTime(time);
		const targetTime = new Date(formattedTime);
		const now = new Date();

		if (isNaN(targetTime.getTime())) {
			console.error("无效的时间:", time);
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
		// 查询列表
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
			// 确保每个抽奖记录的时间字段正确
			lotteriesWithCreator = lotteriesWithCreator.map((lottery) => {
				let updatedLottery = { ...lottery };

				// 处理时间格式
				if (
					typeof updatedLottery.startTime === "string" &&
					updatedLottery.startTime.includes("Z")
				) {
					updatedLottery.startTime = formatTime(updatedLottery.startTime);
				}

				if (
					typeof updatedLottery.endTime === "string" &&
					updatedLottery.endTime.includes("Z")
				) {
					updatedLottery.endTime = formatTime(updatedLottery.endTime);
				}

				return updatedLottery;
			});

			// 获取创建者信息
			const creatorIds = [
				...new Set(
					lotteriesWithCreator
						.map((lottery) => lottery._openid)
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

			// 组合数据，并添加isEnded标志
			lotteriesWithCreator = lotteriesWithCreator.map((lottery) => {
				// 判断是否已结束 - 使用统一函数
				let isEnded = isExpired(lottery.endTime);
				console.log(`抽奖ID: ${lottery._id} 是否已结束: ${isEnded}`);

				// 构建返回结果
				const result = {
					...lottery,
					isEnded, // 添加基于时间的结束标志
				};

				// 添加创建者信息
				if (lottery._openid && creatorsMap[lottery._openid]) {
					result.creator = creatorsMap[lottery._openid];
				}

				return result;
			});

			// 异步更新数据库中带Z后缀的时间格式，不等待结果
			lotteriesWithCreator.forEach((lottery) => {
				if (
					typeof lottery.originalEndTime === "string" &&
					lottery.originalEndTime.includes("Z")
				) {
					lotteryCollection
						.doc(lottery._id)
						.update({
							data: {
								endTime: formatTime(lottery.endTime),
								startTime: formatTime(lottery.startTime),
							},
						})
						.catch((err) =>
							console.error(`更新抽奖 ${lottery._id} 时间格式失败:`, err)
						);
				}
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
