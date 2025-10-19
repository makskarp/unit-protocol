const axios = require("axios");
const logger = require("./logger");
const config = require("./config");

class HyperliquidClient {
  constructor() {
    // Hyperliquid API endpoint
    this.apiUrl = "https://api.hyperliquid.xyz/info";
    this.uxplTokenSymbol = "UXPL"; // Token symbol for UXPL on Hyperliquid
  }

  /**
   * Get UXPL token balance for an address from spot positions
   * @param {string} address - Address to check
   * @returns {Promise<string>} Balance as string
   */
  async getUXPLBalance(address) {
    try {
      logger.debug("Getting UXPL balance from spot clearinghouse state", {
        address,
      });

      const response = await axios.post(this.apiUrl, {
        type: "spotClearinghouseState",
        user: address,
      });

      const state = response.data;
      let balance = "0";

      // Check balances array for UXPL
      if (state && state.balances && Array.isArray(state.balances)) {
        const uxplBalance = state.balances.find(
          (bal) => bal.coin === this.uxplTokenSymbol
        );
        if (uxplBalance) {
          balance = uxplBalance.total || "0";
        }
      }

      logger.debug("UXPL spot balance retrieved", {
        address,
        balance,
        balances: state?.balances?.length || 0,
        allBalances: state?.balances?.map((b) => `${b.coin}: ${b.total}`) || [],
      });
      return balance;
    } catch (error) {
      logger.error("Failed to get UXPL balance", {
        error: error.message,
        address,
      });
      throw error;
    }
  }

  /**
   * Get all spot balances for an address (for debugging)
   * @param {string} address - Address to check
   * @returns {Promise<Array>} All spot balances
   */
  async getAllSpotBalances(address) {
    try {
      logger.debug("Getting all spot balances", { address });

      const response = await axios.post(this.apiUrl, {
        type: "spotClearinghouseState",
        user: address,
      });

      const state = response.data;
      const balances = state?.balances || [];

      logger.debug("All spot balances retrieved", {
        address,
        balancesCount: balances.length,
        balances: balances.map((b) => ({
          coin: b.coin,
          total: b.total,
          token: b.token,
          hold: b.hold,
          entryNtl: b.entryNtl,
        })),
      });

      return balances;
    } catch (error) {
      logger.error("Failed to get all spot balances", {
        error: error.message,
        address,
      });
      throw error;
    }
  }

  /**
   * Check if an address has received UXPL tokens
   * @param {string} address - Address to check
   * @param {string} expectedAmount - Expected amount in UXPL
   * @param {string} previousBalance - Previous balance for comparison
   * @returns {Promise<Object>} Result with balance info
   */
  async checkUXPLReceived(
    address,
    expectedAmount = null,
    previousBalance = "0"
  ) {
    try {
      const currentBalance = await this.getUXPLBalance(address);

      // Convert both balances to numbers for proper comparison
      const currentBalanceNum = parseFloat(currentBalance) || 0;
      const previousBalanceNum = parseFloat(previousBalance) || 0;

      const balanceIncreased = currentBalanceNum > previousBalanceNum;
      const increaseAmount = currentBalanceNum - previousBalanceNum;

      const result = {
        address,
        currentBalance: currentBalance,
        previousBalance: previousBalance,
        currentBalanceNum,
        previousBalanceNum,
        balanceIncreased,
        increaseAmount: increaseAmount.toString(),
        hasReceivedTokens: balanceIncreased && increaseAmount > 0,
        timestamp: new Date().toISOString(),
      };

      logger.info("UXPL balance check completed", result);
      return result;
    } catch (error) {
      logger.error("Failed to check UXPL received", {
        error: error.message,
        address,
        expectedAmount,
      });
      throw error;
    }
  }

  /**
   * Monitor for UXPL token reception
   * @param {string} address - Address to monitor
   * @param {string} expectedAmount - Expected amount (optional)
   * @param {Object} options - Monitoring options
   * @returns {Promise<Object>} Final result when tokens are received
   */
  async monitorUXPLReception(address, expectedAmount = null, options = {}) {
    const {
      pollInterval = 5000, // 5 seconds
      maxRetries = 60, // 5 minutes total
      initialWaitTime = 10000, // 10 seconds
      onProgress = null,
    } = options;

    logger.info("Starting UXPL reception monitoring", {
      address,
      expectedAmount: expectedAmount || "any amount",
      pollInterval,
      maxRetries,
      initialWaitTime,
      note: "Monitoring for any UXPL tokens received (fees may reduce final amount)",
    });

    // Initial wait
    logger.info("Waiting before starting monitoring", {
      waitTime: initialWaitTime,
      address,
    });
    await this.sleep(initialWaitTime);

    // Get initial balance BEFORE monitoring starts
    const initialBalance = await this.getUXPLBalance(address);
    const initialBalanceNum = parseFloat(initialBalance) || 0;

    logger.info("Initial UXPL balance before monitoring", {
      address,
      balance: initialBalance,
      balanceNum: initialBalanceNum,
    });

    let retries = 0;
    let lastBalance = initialBalance;
    let lastBalanceNum = initialBalanceNum;

    while (retries < maxRetries) {
      try {
        const balanceCheck = await this.checkUXPLReceived(
          address,
          expectedAmount,
          lastBalance
        );

        // Check if NEW UXPL tokens have been received (balance increased from last check)
        const currentBalanceNum = parseFloat(balanceCheck.currentBalance) || 0;
        const newTokensReceived = currentBalanceNum > lastBalanceNum;

        if (newTokensReceived) {
          const newTokensAmount = currentBalanceNum - lastBalanceNum;

          logger.info("NEW UXPL tokens received successfully!", {
            address,
            newTokensAmount: newTokensAmount.toString(),
            currentBalance: balanceCheck.currentBalance,
            previousBalance: balanceCheck.previousBalance,
            initialBalance: initialBalance,
            totalNewTokens: currentBalanceNum - initialBalanceNum,
            expectedAmount: expectedAmount,
            totalRetries: retries,
          });

          if (onProgress) {
            onProgress(
              100,
              `NEW UXPL tokens received! Amount: ${newTokensAmount} UXPL (Total new: ${
                currentBalanceNum - initialBalanceNum
              })`
            );
          }

          return {
            success: true,
            address,
            receivedAmount: newTokensAmount.toString(),
            newBalance: balanceCheck.currentBalance,
            previousBalance: balanceCheck.previousBalance,
            initialBalance: initialBalance,
            totalNewTokens: currentBalanceNum - initialBalanceNum,
            expectedAmount: expectedAmount,
            timestamp: balanceCheck.timestamp,
            totalRetries: retries,
          };
        }

        // Update progress
        if (onProgress) {
          const progress = Math.min((retries / maxRetries) * 100, 95);
          const expectedMsg = expectedAmount
            ? ` (expecting ~${expectedAmount} UXPL)`
            : "";
          onProgress(
            progress,
            `Monitoring for UXPL tokens${expectedMsg}... (attempt ${
              retries + 1
            }/${maxRetries})`
          );
        }

        logger.debug("No NEW UXPL tokens received yet, continuing to monitor", {
          address,
          currentBalance: balanceCheck.currentBalance,
          previousBalance: balanceCheck.previousBalance,
          currentBalanceNum: currentBalanceNum,
          lastBalanceNum: lastBalanceNum,
          initialBalance: initialBalance,
          initialBalanceNum: initialBalanceNum,
          retry: retries + 1,
          maxRetries,
        });

        // Update tracking variables for next iteration
        lastBalance = balanceCheck.currentBalance;
        lastBalanceNum = currentBalanceNum;
        await this.sleep(pollInterval);
        retries++;
      } catch (error) {
        logger.error("Error during UXPL monitoring", {
          address,
          error: error.message,
          retry: retries + 1,
          maxRetries,
        });

        if (retries >= maxRetries - 1) {
          throw error;
        }

        await this.sleep(pollInterval);
        retries++;
      }
    }

    throw new Error(`UXPL monitoring timeout after ${maxRetries} attempts`);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = HyperliquidClient;
