// Improved cloud/functions/autoDrawLottery/index.js
const cloud = require("wx-server-sdk");

// Initialize cloud environment
cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const lotteryCollection = db.collection("lotteries");
const participantCollection = db.collection("participants");

/**
 * Check if a date is in the past - improved reliability
 */
function isExpired(date) {
	if (!date) return false;
	try {
		const dateObj = new Date(date);
		const now = new Date();

		// Add a small buffer (5 seconds) to account for processing time
		// This helps prevent edge cases where time is just on the boundary
		now.setSeconds(now.getSeconds() + 5);

		return now >= dateObj;
	} catch (error) {
		console.error("Error checking if time has expired:", error);
		return false;
	}
}

/**
 * Random selection function - ensuring fair selection
 */
function getRandomItems(array, count) {
	// Create a copy to avoid modifying original array
	const arrayCopy = [...array];
	const result = [];

	// Fisher-Yates shuffle algorithm for better randomness
	for (let i = arrayCopy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
	}

	// Take the first 'count' elements
	return arrayCopy.slice(0, Math.min(count, array.length));
}

/**
 * Auto draw main function with improved reliability
 */
exports.main = async (event, context) => {
	console.log("Starting auto draw function...");
	const now = new Date();
	console.log("Current time:", now.toISOString());
	const results = [];

	try {
		// Step 1: Find all lotteries that haven't been drawn yet
		const pendingLotteries = await lotteryCollection
			.where({
				hasDrawn: _.or(_.eq(false), _.exists(false)),
			})
			.limit(20) // Process at most 20 lotteries each time
			.get();

		console.log(`Found ${pendingLotteries.data.length} pending lotteries`);

		// Step 2: Filter out expired lotteries
		const endedLotteries = {
			data: pendingLotteries.data.filter((lottery) => {
				const isEnd = isExpired(lottery.endTime);
				console.log(
					`Lottery ${lottery._id} expired: ${isEnd}, endTime: ${lottery.endTime}`
				);
				return isEnd;
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
			console.log(
				`Lottery end time: ${
					lottery.endTime
				}, Current time: ${now.toISOString()}`
			);

			try {
				// Double check if lottery is already drawn - defensive check
				const latestLotteryStatus = await lotteryCollection
					.doc(lottery._id)
					.get();
				if (latestLotteryStatus.data.hasDrawn) {
					console.log(`Lottery ${lottery._id} is already drawn, skipping`);
					results.push({
						lotteryId: lottery._id,
						title: lottery.title,
						success: true,
						message: "Already drawn, skipped",
						alreadyDrawn: true,
					});
					continue;
				}

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
						// Try transaction first for atomic operation
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

							console.log(
								`Lottery ${lottery._id} draw successful with transaction`
							);
						} catch (error) {
							// Transaction failed, rollback
							await transaction.rollback();
							console.error(
								`Transaction failed for lottery ${lottery._id}:`,
								error
							);
							throw error; // Re-throw to be caught by the outer try-catch
						}
					} catch (error) {
						// If transaction fails, try direct updates as fallback
						console.warn(
							`Using direct updates as fallback for lottery ${lottery._id}`
						);

						try {
							// Update winner status directly
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

							// Update lottery status directly
							await lotteryCollection.doc(lottery._id).update({
								data: {
									hasDrawn: true,
									noParticipants: false,
									winnerCount: winnerCount,
									drawTime: db.serverDate(),
									updateTime: db.serverDate(),
								},
							});

							resultItem.message = `Auto-drawn using direct updates, selected ${winnerCount} winners`;
							resultItem.winnerCount = winnerCount;
							resultItem.noParticipants = false;
							resultItem.usedDirectUpdate = true;

							console.log(`Lottery ${lottery._id} direct update successful`);
						} catch (directUpdateError) {
							console.error(
								`Both transaction and direct updates failed for lottery ${lottery._id}:`,
								directUpdateError
							);
							throw directUpdateError;
						}
					}
				}

				results.push(resultItem);

				// Add a small delay between processing lotteries
				// This can help prevent database contention
				await new Promise((resolve) => setTimeout(resolve, 500));
			} catch (error) {
				console.error(`Error processing lottery ${lottery._id}:`, error);
				results.push({
					lotteryId: lottery._id,
					title: lottery.title,
					success: false,
					message: `Draw failed: ${error.message || "Unknown error"}`,
					error: error.message,
				});
			}
		}

		return {
			success: true,
			message: `Processed ${results.length} lotteries`,
			results: results,
			processingTime: new Date() - now + "ms",
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
