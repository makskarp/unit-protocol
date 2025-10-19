#!/usr/bin/env node

const logger = require("./logger");
const config = require("./config");
const HyperunitClient = require("./hyperunit-client");
const PlasmaClient = require("./plasma-client");
const HyperliquidClient = require("./hyperliquid-client");

class HyperunitXPLDepositor {
  constructor() {
    this.hyperunitClient = new HyperunitClient();
    this.plasmaClient = new PlasmaClient();
    this.hyperliquidClient = new HyperliquidClient();
  }

  /**
   * Main function to execute the deposit process
   * @param {Object} options - Deposit options
   * @returns {Promise<Object>} Deposit result
   */
  async executeDeposit(options) {
    const {
      dstAddr, // Destination address on Hyperliquid
      amount, // Amount of XPL to send
      srcChain = "plasma",
      dstChain = "hyperliquid",
      asset = "xpl",
      monitorDeposit = true,
      onStageChange = null,
      onProgress = null,
    } = options;

    try {
      logger.info("Starting XPL deposit process", {
        dstAddr,
        amount,
        srcChain,
        dstChain,
        asset,
      });

      // Step 1: Generate deposit address
      logger.info("Step 1: Generating deposit address");
      const depositResponse = await this.hyperunitClient.generateDepositAddress(
        srcChain,
        dstChain,
        asset,
        dstAddr
      );

      const depositAddress = depositResponse.address;
      logger.info("Deposit address generated", { depositAddress });

      // Step 2: Send XPL to deposit address
      logger.info("Step 2: Sending XPL to deposit address");
      const txReceipt = await this.plasmaClient.sendXPL(depositAddress, amount);

      logger.info("XPL sent successfully", {
        txHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
      });

      // Step 3: Monitor UXPL reception on Hyperliquid (optional)
      let monitoringResult = null;
      if (monitorDeposit) {
        logger.info("Step 3: Monitoring UXPL reception on Hyperliquid");

        // Wait for initial confirmation on Plasma
        await this.plasmaClient.waitForConfirmation(
          txReceipt.transactionHash,
          1
        );

        // Monitor for UXPL tokens on Hyperliquid
        monitoringResult = await this.hyperliquidClient.monitorUXPLReception(
          dstAddr, // Monitor the destination address on Hyperliquid
          amount, // Expected amount
          {
            onProgress,
            pollInterval: config.monitoring.pollInterval,
            maxRetries: config.monitoring.maxRetries,
            initialWaitTime: config.monitoring.initialWaitTime,
          }
        );
      }

      const result = {
        success: true,
        depositAddress,
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        amount,
        dstAddr,
        monitoringResult,
      };

      logger.info("Deposit process completed successfully", result);
      return result;
    } catch (error) {
      logger.error("Deposit process failed", {
        error: error.message,
        stack: error.stack,
        options,
      });

      throw error;
    }
  }

  /**
   * Get account balance
   * @param {string} address - Account address (optional, defaults to sender address)
   * @returns {Promise<string>} Balance in XPL
   */
  async getBalance(address = null) {
    try {
      const accountAddress = address || config.wallet.senderAddress;
      const balanceWei = await this.plasmaClient.getBalance(accountAddress);
      const balanceXPL = this.plasmaClient.fromWei(balanceWei);

      logger.info("Account balance retrieved", {
        address: accountAddress,
        balance: balanceXPL,
        balanceWei,
      });

      return balanceXPL;
    } catch (error) {
      logger.error("Failed to get balance", {
        error: error.message,
        address: address || config.wallet.senderAddress,
      });
      throw error;
    }
  }

  /**
   * Estimate fees for deposit operation
   * @param {string} srcChain - Source chain
   * @param {string} dstChain - Destination chain
   * @param {string} asset - Asset symbol
   * @returns {Promise<Object>} Fee estimation
   */
  async estimateFees(
    srcChain = "plasma",
    dstChain = "hyperliquid",
    asset = "xpl"
  ) {
    try {
      logger.info("Estimating fees", { srcChain, dstChain, asset });

      const fees = await this.hyperunitClient.estimateFees(
        srcChain,
        dstChain,
        asset
      );

      logger.info("Fees estimated", fees);
      return fees;
    } catch (error) {
      logger.error("Failed to estimate fees", {
        error: error.message,
        srcChain,
        dstChain,
        asset,
      });
      throw error;
    }
  }

  /**
   * Monitor UXPL reception on Hyperliquid
   * @param {Object} options - Monitoring options
   * @returns {Promise<Object>} Monitoring result
   */
  async monitorDeposit(options) {
    const {
      address = null,
      expectedAmount = null,
      onProgress = null,
    } = options;

    try {
      logger.info("Starting UXPL reception monitoring", {
        address,
        expectedAmount,
      });

      if (!address) {
        throw new Error("Address is required for monitoring");
      }

      const result = await this.hyperliquidClient.monitorUXPLReception(
        address,
        expectedAmount,
        {
          onProgress,
          pollInterval: config.monitoring.pollInterval,
          maxRetries: config.monitoring.maxRetries,
          initialWaitTime: config.monitoring.initialWaitTime,
        }
      );

      logger.info("UXPL reception monitoring completed", result);
      return result;
    } catch (error) {
      logger.error("UXPL reception monitoring failed", {
        error: error.message,
        address,
        expectedAmount,
      });
      throw error;
    }
  }

  /**
   * Get UXPL balance on Hyperliquid
   * @param {string} address - Address to check
   * @returns {Promise<string>} Balance in UXPL
   */
  async getUXPLBalance(address) {
    try {
      const balance = await this.hyperliquidClient.getUXPLBalance(address);
      logger.info("UXPL balance retrieved", { address, balance });
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
   * Get all spot balances on Hyperliquid (for debugging)
   * @param {string} address - Address to check
   * @returns {Promise<Array>} All spot balances
   */
  async getAllSpotBalances(address) {
    try {
      const balances = await this.hyperliquidClient.getAllSpotBalances(address);
      logger.info("All spot balances retrieved", {
        address,
        balancesCount: balances.length,
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
   * Get withdraw queue status
   * @returns {Promise<Object>} Withdraw queue status
   */
  async getWithdrawQueue() {
    try {
      const queueStatus = await this.hyperunitClient.getWithdrawQueue();
      logger.info("Withdraw queue status retrieved", queueStatus);
      return queueStatus;
    } catch (error) {
      logger.error("Failed to get withdraw queue", { error: error.message });
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const depositor = new HyperunitXPLDepositor();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "deposit":
        if (args.length < 3) {
          console.error("Usage: node index.js deposit <dstAddr> <amount>");
          process.exit(1);
        }

        const dstAddr = args[1];
        const amount = args[2];

        await depositor.executeDeposit({
          dstAddr,
          amount,
          onProgress: (progress, message) => {
            console.log(`⏳ ${message} (${progress}%)`);
          },
        });
        break;

      case "balance":
        const address = args[1] || null;
        const balance = await depositor.getBalance(address);
        console.log(`💰 Plasma Balance: ${balance} XPL`);
        break;

      case "uxpl-balance":
        if (args.length < 2) {
          console.error("Usage: node index.js uxpl-balance <address>");
          process.exit(1);
        }

        const uxplAddress = args[1];
        const uxplBalance = await depositor.getUXPLBalance(uxplAddress);
        console.log(`💰 Hyperliquid UXPL Balance: ${uxplBalance} UXPL`);
        break;

      case "spot-balances":
        if (args.length < 2) {
          console.error("Usage: node index.js spot-balances <address>");
          process.exit(1);
        }

        const spotAddress = args[1];
        const allBalances = await depositor.getAllSpotBalances(spotAddress);
        console.log("💰 All Spot Balances:");
        allBalances.forEach((balance) => {
          console.log(`  ${balance.coin}: ${balance.total}`);
        });
        break;

      case "estimate-fees":
        const fees = await depositor.estimateFees();
        console.log("💸 Estimated fees:", JSON.stringify(fees, null, 2));
        break;

      case "monitor":
        if (args.length < 2) {
          console.error(
            "Usage: node index.js monitor <address> [expectedAmount]"
          );
          process.exit(1);
        }

        const addressToMonitor = args[1];
        const expectedAmount = args[2] || null;

        await depositor.monitorDeposit({
          address: addressToMonitor,
          expectedAmount,
          onProgress: (progress, message) => {
            console.log(`⏳ ${message} (${progress}%)`);
          },
        });
        break;

      case "queue":
        const queue = await depositor.getWithdrawQueue();
        console.log("📋 Withdraw queue:", JSON.stringify(queue, null, 2));
        break;

      default:
        console.log(`
🚀 Hyperunit XPL Depositor

Usage:
  node index.js deposit <dstAddr> <amount>              - Send XPL deposit
  node index.js balance [address]                       - Get Plasma XPL balance
  node index.js uxpl-balance <address>                  - Get Hyperliquid UXPL balance
  node index.js spot-balances <address>                 - Get all spot balances on Hyperliquid
  node index.js estimate-fees                           - Estimate deposit fees
  node index.js monitor <address> [expectedAmount]      - Monitor UXPL reception on Hyperliquid
  node index.js queue                                   - Get withdraw queue status

Examples:
  node index.js deposit 0x123... 1.5                    - Send 1.5 XPL to Hyperliquid address
  node index.js balance                                  - Get sender Plasma balance
  node index.js uxpl-balance 0x123...                   - Get UXPL balance on Hyperliquid
  node index.js spot-balances 0x123...                  - Get all spot balances on Hyperliquid
  node index.js monitor 0x123...                        - Monitor UXPL reception for address
  node index.js monitor 0x123... 1.5                    - Monitor UXPL reception with expected amount
        `);
    }
  } catch (error) {
    logger.error("Command failed", { command, error: error.message });
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for use as module
module.exports = HyperunitXPLDepositor;

// Run CLI if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error("Unhandled error", {
      error: error.message,
      stack: error.stack,
    });
    console.error("❌ Unhandled error:", error.message);
    process.exit(1);
  });
}
