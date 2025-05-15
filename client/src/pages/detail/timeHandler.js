// client/src/pages/detail/timeHandler.js (Simplified version)
import {
  formatChineseTime,
  getCountdownString,
  formatTime,
} from "../../utils/timeUtils";

/**
 * Handle countdown logic
 */
export const startCountdownTimer = (
  endTime,
  countdownTimer,
  setCountdownTimer,
  setCountdown,
  initialLoadDoneRef,
  refreshingRef,
  fetchLotteryDetail,
  lotteryId
) => {
  // Clear any existing timer
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  try {
    // Parse the end time into a Date object
    const endDateTime = new Date(endTime);
    const now = new Date();

    console.log("Starting countdown, current time:", formatChineseTime(now));
    console.log("Target time:", formatChineseTime(endDateTime));

    // Check if date is valid
    if (isNaN(endDateTime.getTime())) {
      console.error("Invalid end time:", endTime);
      setCountdown("Invalid time");
      return;
    }

    // If end time has passed, display 00:00:00
    if (now >= endDateTime) {
      console.log("End time has passed, showing zero time");
      setCountdown("00:00:00");

      // Only refresh once to avoid repeated refreshes
      if (initialLoadDoneRef.current && !refreshingRef.current) {
        console.log("First refresh after lottery ends");

        // Set refresh flag
        refreshingRef.current = true;

        // Set a delay to ensure it doesn't refresh immediately
        setTimeout(() => {
          // Pass lotteryId as parameter
          if (lotteryId) {
            fetchLotteryDetail(lotteryId);
          } else {
            console.error("Cannot refresh lottery details: lotteryId is empty");
          }

          // Set timer to refresh again to get possible draw results
          setTimeout(() => {
            console.log("Trying to refresh again to get draw results");
            refreshingRef.current = false; // Reset refresh flag

            if (lotteryId) {
              fetchLotteryDetail(lotteryId);
            } else {
              console.error(
                "Cannot refresh lottery details: lotteryId is empty"
              );
            }
          }, 8000); // Refresh again after 8 seconds
        }, 3000);
      }
      return;
    }

    // Use utility function to get countdown string
    setCountdown(getCountdownString(endTime));

    // Set new timer - update every second
    const timer = setInterval(() => {
      const countdown = getCountdownString(endTime);
      setCountdown(countdown);

      // If countdown ends, clear timer and refresh data
      if (countdown === "00:00:00") {
        clearInterval(timer);
        console.log("Countdown ended, refreshing data");

        // Set refresh flag
        refreshingRef.current = true;

        // Delay refresh for a few seconds to give auto draw cloud function time to execute
        setTimeout(() => {
          if (lotteryId) {
            fetchLotteryDetail(lotteryId);
          } else {
            console.error("Cannot refresh lottery details: lotteryId is empty");
          }

          // Refresh again after 5 seconds to get latest draw results
          setTimeout(() => {
            console.log("Trying to get draw results again");
            refreshingRef.current = false; // Reset refresh flag

            if (lotteryId) {
              fetchLotteryDetail(lotteryId);
            } else {
              console.error(
                "Cannot refresh lottery details: lotteryId is empty"
              );
            }
          }, 5000);
        }, 3000);
      }
    }, 1000);

    setCountdownTimer(timer);
    return timer;
  } catch (error) {
    console.error("Error starting countdown:", error);
    setCountdown("Timer error");
    return null;
  }
};
