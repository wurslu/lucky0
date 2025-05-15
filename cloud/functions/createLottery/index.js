// cloud/functions/createLottery/index.js (Simplified version)
const cloud = require("wx-server-sdk");

// Initialize cloud environment
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const lotteryCollection = db.collection("lotteries");
const userCollection = db.collection("users");

// Main function
exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();
	const { title, description, startTime, endTime, prizeCount } = event;

	// Parameter validation
	if (!title) {
		return { success: false, message: "Title cannot be empty" };
	}

	if (!endTime) {
		return { success: false, message: "Draw time cannot be empty" };
	}

	if (!prizeCount || prizeCount < 1) {
		return { success: false, message: "Prize count must be at least 1" };
	}

	// Use provided times or default to now for start time
	const formattedStartTime =
		startTime ||
		new Date()
			.toLocaleString("zh-CN", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: false,
			})
			.replace(/\//g, "-");

	console.log("Formatted start time:", formattedStartTime);
	console.log("Formatted end time:", endTime);

	// Create Date objects for comparison
	const startDateTime = new Date(formattedStartTime);
	const endDateTime = new Date(endTime);

	// Validate end time must be after start time
	if (endDateTime <= startDateTime) {
		return { success: false, message: "Draw time must be after start time" };
	}

	try {
		console.log("Current user OPENID:", wxContext.OPENID);

		// Check user permissions
		const userResult = await userCollection
			.where({
				_openid: wxContext.OPENID,
			})
			.get();

		console.log("User query result:", userResult);

		if (userResult.data.length === 0) {
			return {
				success: false,
				message: "User does not exist, please login again",
			};
		}

		const user = userResult.data[0];
		console.log("Found user:", user);

		// Check if user has creation permission (admin)
		if (!user.isAdmin) {
			return {
				success: false,
				message: "You do not have permission to create a lottery",
			};
		}

		// Create lottery
		const now = db.serverDate();

		// Add lottery record - using simplified time strings
		const result = await lotteryCollection.add({
			data: {
				title,
				description: description || title,
				startTime: formattedStartTime,
				endTime: endTime,
				prizeCount: parseInt(prizeCount),
				_openid: wxContext.OPENID, // Use _openid consistently
				createTime: now,
				updateTime: now,
				hasDrawn: false,
			},
		});

		// Get created lottery info
		const lotteryResult = await lotteryCollection.doc(result._id).get();

		return {
			success: true,
			data: lotteryResult.data,
		};
	} catch (error) {
		console.error("Failed to create lottery", error);
		return {
			success: false,
			message:
				"Failed to create lottery, please try again: " +
				(error.message || "Unknown error"),
			error,
		};
	}
};
