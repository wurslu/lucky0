// cloud/functions/drawLottery/index.js (Simplified version)
const cloud = require("wx-server-sdk");

// Initialize cloud environment
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");
const userCollection = db.collection("users");

// Random selection function
function getRandomItems(array, count) {
	const shuffled = [...array].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, Math.min(count, array.length));
}

// Main function
exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();
	const { id } = event;

	console.log("Manual draw operation - Lottery ID:", id);
	console.log("Current user OPENID:", wxContext.OPENID);

	if (!id) {
		return {
			success: false,
			message: "Lottery ID cannot be empty",
		};
	}

	try {
		// Query lottery information
		const lotteryResult = await lotteryCollection.doc(id).get();

		if (!lotteryResult.data) {
			return {
				success: false,
				message: "Lottery not found",
			};
		}

		const lottery = lotteryResult.data;
		console.log("Lottery info:", lottery);

		// Check if lottery has already been drawn
		if (lottery.hasDrawn) {
			console.log("Lottery already drawn, cannot draw again");
			return {
				success: false,
				message:
					"This lottery has already been drawn and cannot be drawn again",
			};
		}

		// Query current user information, check if they have permission
		const userResult = await userCollection
			.where({
				_openid: wxContext.OPENID,
			})
			.get();

		console.log("User query result:", userResult);

		if (userResult.data.length === 0) {
			return {
				success: false,
				message: "User does not exist",
			};
		}

		const user = userResult.data[0];
		console.log("Current user info:", user);

		// Check if user is the creator or an admin
		const isCreator = lottery._openid === wxContext.OPENID;

		if (!isCreator && !user.isAdmin) {
			return {
				success: false,
				message: "You do not have permission to perform the draw operation",
			};
		}

		// Query all participants
		const participantsResult = await participantCollection
			.where({
				lotteryId: id,
			})
			.get();

		const participants = participantsResult.data;
		console.log("Number of participants:", participants.length);

		// Handle case with no participants
		if (participants.length === 0) {
			console.log("No participants in lottery");

			// Mark lottery as drawn but with no participants
			const updateResult = await lotteryCollection.doc(id).update({
				data: {
					hasDrawn: true,
					noParticipants: true,
					winnerCount: 0,
					drawTime: db.serverDate(),
					updateTime: db.serverDate(),
				},
			});

			console.log("Update result for no participants lottery:", updateResult);

			return {
				success: true,
				message: "Lottery drawn, but no participants",
				data: {
					winnerCount: 0,
					noParticipants: true,
				},
			};
		}

		// Determine number of winners
		const winnerCount = Math.min(lottery.prizeCount || 1, participants.length);
		console.log("Winner count:", winnerCount);

		// Randomly select winners
		const winners = getRandomItems(participants, winnerCount);
		const winnerIds = winners.map((w) => w._id);
		console.log("Winner IDs:", winnerIds);

		let updateSuccess = false;
		let detailedWinners = [];

		try {
			// Use transaction to handle draw operation
			const transaction = await db.startTransaction();

			try {
				// Update winner status
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

					console.log(`Updated winner status`);
				}

				// Update lottery information
				await transaction
					.collection("lotteries")
					.doc(id)
					.update({
						data: {
							hasDrawn: true,
							noParticipants: false,
							winnerCount: winnerCount,
							drawTime: db.serverDate(),
							updateTime: db.serverDate(),
						},
					});

				// Commit transaction
				await transaction.commit();
				updateSuccess = true;
				console.log("Draw transaction committed successfully");
			} catch (error) {
				// Transaction failed, rollback
				await transaction.rollback();
				console.error("Draw transaction failed, rolled back:", error);
				throw error;
			}
		} catch (error) {
			console.error(
				"Transaction processing failed, trying direct update:",
				error
			);

			// If transaction fails, try direct update
			try {
				// Update winner status
				if (winnerIds.length > 0) {
					for (const winnerId of winnerIds) {
						await participantCollection.doc(winnerId).update({
							data: {
								isWinner: true,
								updateTime: db.serverDate(),
							},
						});
					}
				}

				// Update lottery information
				await lotteryCollection.doc(id).update({
					data: {
						hasDrawn: true,
						noParticipants: false,
						winnerCount: winnerCount,
						drawTime: db.serverDate(),
						updateTime: db.serverDate(),
					},
				});

				updateSuccess = true;
				console.log("Direct update successful");
			} catch (directUpdateError) {
				console.error("Direct update also failed:", directUpdateError);
				throw directUpdateError;
			}
		}

		// Confirm update was successful, query winner details for return
		if (updateSuccess) {
			try {
				// Get winner openids
				const winnerOpenIds = winners.map((w) => w._openid).filter((id) => id);

				// Query user information
				if (winnerOpenIds.length > 0) {
					const userDetails = await userCollection
						.where({
							_openid: _.in(winnerOpenIds),
						})
						.get();

					// Create user information mapping
					const userMap = {};
					if (userDetails.data && userDetails.data.length > 0) {
						userDetails.data.forEach((user) => {
							if (user._openid) {
								userMap[user._openid] = user;
							}
						});
					}

					// Combine winner and user information
					detailedWinners = winners.map((winner) => {
						const userInfo = userMap[winner._openid] || {};
						return {
							...winner,
							nickName: userInfo.nickName,
							avatarUrl: userInfo.avatarUrl,
							isWinner: true,
						};
					});
				} else {
					// If unable to get details, use original winner information
					detailedWinners = winners.map((w) => ({ ...w, isWinner: true }));
				}
			} catch (error) {
				console.error("Failed to get winner details:", error);
				// If getting details fails, at least return basic winner information
				detailedWinners = winners.map((w) => ({ ...w, isWinner: true }));
			}
		}

		return {
			success: true,
			message: "Draw successful",
			data: {
				winnerCount,
				winners: detailedWinners,
			},
		};
	} catch (error) {
		console.error("Draw failed", error);
		return {
			success: false,
			message: "Draw failed, please try again: " + error.message,
			error: error.message,
		};
	}
};
