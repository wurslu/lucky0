// cloud/functions/autoDrawLottery/index.js (Simplified version)
const cloud = require("wx-server-sdk");

// Initialize cloud environment
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

// Check if a date is in the past
function isExpired(date) {
	if (!date) return false;
	try {
		const dateObj = new Date(date);
		return dateObj < new Date();
	} catch (error) {
		console.error("Error checking if time has expired:", error);
		return false;
	}
}

// Random selection function
function getRandomItems(array, count) {
	const shuffled = [...array].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, Math.min(count, array.length));
}

// Auto draw main function
exports.main = async (event, context) => {
	console.log("Starting auto draw function...");
	const now = new Date();
	const results = [];

	try {
		// Improved query logic: first get all undrawn lotteries
		const pendingLotteries = await lotteryCollection
			.where({
				hasDrawn: _.or(_.eq(false), _.exists(false)),
			})
			.limit(20) // Process at most 20 lotteries each time
			.get();

		// Manually filter out expired lotteries
		const endedLotteries = {
			data: pendingLotteries.data.filter((lottery) => {
				// Use simplified time check
				return isExpired(lottery.endTime);
			}),
		};

		console.log(
			`Found ${endedLotteries.data.length} lotteries that need to be drawn`
		);

		// If no lotteries need to be drawn
		if (endedLotteries.data.length === 0) {
			return {
				success: true,
				message: "No lotteries need to be drawn",
				results: [],
			};
		}

		// Process each ended lottery
		for (const lottery of endedLotteries.data) {
			console.log(
				`Processing lottery ID: ${lottery._id}, Title: ${lottery.title}`
			);
			console.log(`Lottery end time: ${lottery.endTime}`);

			try {
				// Get all participants for this lottery
				const participantsResult = await participantCollection
					.where({
						lotteryId: lottery._id,
					})
					.get();

				const participants = participantsResult.data;
				console.log(
					`Lottery ${lottery._id} has ${participants.length} participants`
				);

				let resultItem = {
					lotteryId: lottery._id,
					title: lottery.title,
					success: true,
				};

				// Handle case with no participants
				if (participants.length === 0) {
					console.log(`Lottery ${lottery._id} has no participants`);

					// Mark lottery as drawn but with no participants
					await lotteryCollection.doc(lottery._id).update({
						data: {
							hasDrawn: true,
							noParticipants: true,
							winnerCount: 0,
							drawTime: db.serverDate(),
							updateTime: db.serverDate(),
						},
					});

					resultItem.message = "Auto-drawn, no participants";
					resultItem.winnerCount = 0;
					resultItem.noParticipants = true;
				} else {
					// With participants, proceed with draw
					console.log(`Lottery ${lottery._id} starting to draw winners`);

					// Determine winner count (not exceeding participant count and prize count)
					const winnerCount = Math.min(
						lottery.prizeCount || 1,
						participants.length
					);

					// Randomly select winners
					const winners = getRandomItems(participants, winnerCount);
					const winnerIds = winners.map((w) => w._id);

					console.log(
						`Lottery ${lottery._id} selected ${winnerIds.length} winners`
					);

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
							}

							// Update lottery status
							await transaction
								.collection("lotteries")
								.doc(lottery._id)
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

							resultItem.message = `Auto-drawn, selected ${winnerCount} winners`;
							resultItem.winnerCount = winnerCount;
							resultItem.noParticipants = false;

							console.log(`Lottery ${lottery._id} draw successful`);
						} catch (error) {
							// Transaction failed, rollback
							await transaction.rollback();

							// Try direct update
							console.log(
								`Transaction draw failed, trying direct update: ${error.message}`
							);

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

							// Update lottery status
							await lotteryCollection.doc(lottery._id).update({
								data: {
									hasDrawn: true,
									noParticipants: false,
									winnerCount: winnerCount,
									drawTime: db.serverDate(),
									updateTime: db.serverDate(),
								},
							});

							resultItem.message = `Direct update drawn, selected ${winnerCount} winners`;
							resultItem.winnerCount = winnerCount;
							resultItem.noParticipants = false;
							resultItem.transactionFailed = true;

							console.log(`Lottery ${lottery._id} direct update successful`);
						}
					} catch (error) {
						// If both transaction and direct update fail
						console.error(
							`Lottery ${lottery._id} draw operation completely failed:`,
							error
						);
						throw new Error(`Draw operation failed: ${error.message}`);
					}
				}

				results.push(resultItem);
			} catch (error) {
				console.error(`Error processing lottery ${lottery._id}:`, error);
				results.push({
					lotteryId: lottery._id,
					title: lottery.title,
					success: false,
					message: `Draw failed: ${error.message || "Unknown error"}`,
				});
			}
		}

		return {
			success: true,
			message: `Processed ${results.length} lotteries`,
			results: results,
		};
	} catch (error) {
		console.error("Auto draw execution failed:", error);
		return {
			success: false,
			message: `Auto draw execution failed: ${
				error.message || "Unknown error"
			}`,
			error: error.message,
			results: results,
		};
	}
};
