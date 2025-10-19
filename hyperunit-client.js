const axios = require("axios");
const logger = require("./logger");
const config = require("./config");

class HyperunitClient {
  constructor() {
    this.apiBase = config.hyperunit.apiBase;
    this.timeout = config.hyperunit.timeout;

    this.client = axios.create({
      baseURL: this.apiBase,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "hyperunit-xpl-depositor/1.0.0",
      },
    });
  }

  /**
   * Generate a deposit address using Hyperunit API
   * @param {string} srcChain - Source chain (e.g., 'plasma')
   * @param {string} dstChain - Destination chain (e.g., 'hyperliquid')
   * @param {string} asset - Asset symbol (e.g., 'xpl')
   * @param {string} dstAddr - Destination address on Hyperliquid
   * @returns {Promise<Object>} Response containing deposit address
   */
  async generateDepositAddress(srcChain, dstChain, asset, dstAddr) {
    try {
      logger.info("Generating deposit address", {
        srcChain,
        dstChain,
        asset,
        dstAddr,
      });

      const endpoint = `/gen/${srcChain}/${dstChain}/${asset}/${dstAddr}`;
      const response = await this.client.get(endpoint);

      if (!response.data || !response.data.address) {
        throw new Error("Invalid response from Hyperunit API: missing address");
      }

      logger.info("Deposit address generated successfully", {
        address: response.data.address,
        srcChain,
        dstChain,
        asset,
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to generate deposit address", {
        error: error.message,
        srcChain,
        dstChain,
        asset,
        dstAddr,
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
      logger.debug("Getting withdraw queue status");

      const response = await this.client.get("/withdraw-queue");
      return response.data;
    } catch (error) {
      logger.error("Failed to get withdraw queue", { error: error.message });
      throw error;
    }
  }

  /**
   * Estimate fees for a deposit operation
   * @param {string} srcChain - Source chain
   * @param {string} dstChain - Destination chain
   * @param {string} asset - Asset symbol
   * @returns {Promise<Object>} Fee estimation
   */
  async estimateFees(srcChain, dstChain, asset) {
    try {
      logger.debug("Estimating fees", { srcChain, dstChain, asset });

      const endpoint = `/estimate/${srcChain}/${dstChain}/${asset}`;
      const response = await this.client.get(endpoint);

      return response.data;
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
}

module.exports = HyperunitClient;
