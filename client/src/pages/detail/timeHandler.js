// Improved client/src/pages/detail/timeHandler.js
import {
  formatChineseTime,
  getCountdownString,
  isExpired,
} from "../../utils/timeUtils";

/**
 * Handle countdown logic with improved auto-draw mechanism
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

    // If end time has already passed, trigger refresh and display 00:00:00
    if (now >= endDateTime) {
      console.log("End time has passed, showing zero time");
      setCountdown("00:00:00");

      // Only refresh once to avoid repeated refreshes
      if (initialLoadDoneRef.current && !refreshingRef.current) {
        console.log("First refresh after lottery ends");

        // Set refresh flag to prevent multiple refreshes
        refreshingRef.current = true;

        // Immediate first check
        if (lotteryId) {
          fetchLotteryDetail(lotteryId, true); // Force fetch with true parameter
        } else {
          console.error("Cannot refresh lottery details: lotteryId is empty");
        }

        // First retry after 3 seconds
        setTimeout(() => {
          console.log("First retry to get draw results");
          if (lotteryId) {
            fetchLotteryDetail(lotteryId, true); // Force fetch
          }

          // Second retry after another 5 seconds
          setTimeout(() => {
            console.log("Second retry to get draw results");
            refreshingRef.current = false; // Reset refresh flag

            if (lotteryId) {
              fetchLotteryDetail(lotteryId, true);
            }

            // Final retry after 10 more seconds
            setTimeout(() => {
              console.log("Final retry to get draw results");
              if (lotteryId) {
                fetchLotteryDetail(lotteryId, true);
              }
            }, 10000);
          }, 5000);
        }, 3000);
      }
      return;
    }

    // Use utility function to get countdown string
    setCountdown(getCountdownString(endTime));

    // Set new timer - update every second
    const timer = setInterval(() => {
      const currentCountdown = getCountdownString(endTime);
      setCountdown(currentCountdown);

      // Check if countdown has ended
      if (currentCountdown === "00:00:00") {
        clearInterval(timer);
        console.log(
          "Countdown just reached zero, triggering draw refresh sequence"
        );

        // Prevent multiple refreshes
        if (!refreshingRef.current) {
          refreshingRef.current = true;

          // Show loading indicator to user
          console.log("Initiating auto-draw sequence...");

          // Try to trigger auto-draw and refresh in sequence
          // First immediate check
          if (lotteryId) {
            fetchLotteryDetail(lotteryId, true);
          }

          // Sequence of retries with increasing delays
          const retryTimes = [3000, 5000, 8000, 15000];
          let retryCount = 0;

          const attemptRefresh = () => {
            if (retryCount < retryTimes.length) {
              setTimeout(() => {
                console.log(
                  `Retry attempt ${retryCount + 1} to get draw results`
                );
                if (lotteryId) {
                  fetchLotteryDetail(lotteryId, true);
                }
                retryCount++;
                attemptRefresh();
              }, retryTimes[retryCount]);
            } else {
              // Final attempt and reset flag
              refreshingRef.current = false;
              console.log("Auto-draw refresh sequence completed");
            }
          };

          // Start the retry sequence
          attemptRefresh();
        }
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
