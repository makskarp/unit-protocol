const { Web3 } = require("web3");
const logger = require("./logger");
const config = require("./config");

class PlasmaClient {
  constructor() {
    this.rpcUrl = config.plasma.rpcUrl;
    this.chainId = config.plasma.chainId;
    this.gasLimit = config.plasma.gasLimit;
    this.gasMultiplier = config.plasma.gasMultiplier;
    this.privateKey = config.wallet.privateKey;
    this.senderAddress = config.wallet.senderAddress;

    // Initialize Web3
    this.web3 = new Web3(new Web3.providers.HttpProvider(this.rpcUrl));

    // Create account from private key
    this.account = this.web3.eth.accounts.privateKeyToAccount(this.privateKey);
    this.web3.eth.accounts.wallet.add(this.account);
  }

  /**
   * Get current gas price
   * @returns {Promise<string>} Gas price in wei
   */
  async getGasPrice() {
    try {
      const gasPrice = await this.web3.eth.getGasPrice();
      const adjustedGasPrice =
        (BigInt(gasPrice) * BigInt(Math.floor(this.gasMultiplier * 100))) /
        BigInt(100);
      return adjustedGasPrice.toString();
    } catch (error) {
      logger.error("Failed to get gas price", { error: error.message });
      throw error;
    }
  }

  /**
   * Get transaction nonce
   * @param {string} address - Account address
   * @returns {Promise<number>} Nonce value
   */
  async getNonce(address) {
    try {
      return await this.web3.eth.getTransactionCount(address, "latest");
    } catch (error) {
      logger.error("Failed to get nonce", { error: error.message, address });
      throw error;
    }
  }

  /**
   * Get account balance
   * @param {string} address - Account address
   * @returns {Promise<string>} Balance in wei
   */
  async getBalance(address) {
    try {
      return await this.web3.eth.getBalance(address);
    } catch (error) {
      logger.error("Failed to get balance", { error: error.message, address });
      throw error;
    }
  }

  /**
   * Convert XPL amount to wei
   * @param {string|number} amount - Amount in XPL
   * @returns {string} Amount in wei
   */
  toWei(amount) {
    return this.web3.utils.toWei(amount.toString(), "ether");
  }

  /**
   * Convert wei amount to XPL
   * @param {string|number} amount - Amount in wei
   * @returns {string} Amount in XPL
   */
  fromWei(amount) {
    return this.web3.utils.fromWei(amount.toString(), "ether");
  }

  /**
   * Send XPL to specified address
   * @param {string} toAddress - Recipient address
   * @param {string|number} amount - Amount in XPL
   * @param {Object} options - Additional transaction options
   * @returns {Promise<Object>} Transaction receipt
   */
  async sendXPL(toAddress, amount, options = {}) {
    try {
      logger.info("Preparing XPL transaction", {
        to: toAddress,
        amount: amount.toString(),
        from: this.senderAddress,
      });

      // Convert amount to wei
      const amountWei = this.toWei(amount);

      // Get current nonce and gas price
      const nonce = await this.getNonce(this.senderAddress);
      const gasPrice = await this.getGasPrice();

      // Check balance
      const balance = await this.getBalance(this.senderAddress);
      const requiredBalance =
        BigInt(amountWei) + BigInt(gasPrice) * BigInt(this.gasLimit);

      if (BigInt(balance) < requiredBalance) {
        throw new Error(
          `Insufficient balance. Required: ${this.fromWei(
            requiredBalance.toString()
          )} XPL, Available: ${this.fromWei(balance)} XPL`
        );
      }

      // Build transaction
      const tx = {
        from: this.senderAddress,
        to: toAddress,
        value: amountWei,
        gas: this.gasLimit,
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: this.chainId,
        ...options,
      };

      logger.info("Transaction details", {
        from: tx.from,
        to: tx.to,
        value: tx.value,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce,
        chainId: tx.chainId,
      });

      // Sign and send transaction
      const signedTx = await this.web3.eth.accounts.signTransaction(
        tx,
        this.privateKey
      );
      const receipt = await this.web3.eth.sendSignedTransaction(
        signedTx.rawTransaction
      );

      logger.info("XPL transaction sent successfully", {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      });

      return receipt;
    } catch (error) {
      logger.error("Failed to send XPL", {
        error: error.message,
        to: toAddress,
        amount: amount.toString(),
      });
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   * @param {string} txHash - Transaction hash
   * @param {number} confirmations - Number of confirmations to wait for
   * @returns {Promise<Object>} Transaction receipt
   */
  async waitForConfirmation(txHash, confirmations = 1) {
    try {
      logger.info("Waiting for transaction confirmation", {
        txHash,
        confirmations,
      });

      let receipt = await this.web3.eth.getTransactionReceipt(txHash);

      if (!receipt) {
        // Wait for transaction to be mined
        const tx = await this.web3.eth.getTransaction(txHash);
        if (!tx) {
          throw new Error("Transaction not found");
        }

        logger.info("Transaction found, waiting for mining", { txHash });

        // Poll for receipt
        const maxAttempts = 60; // 5 minutes max
        let attempts = 0;

        while (!receipt && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
          receipt = await this.web3.eth.getTransactionReceipt(txHash);
          attempts++;
        }

        if (!receipt) {
          throw new Error("Transaction not mined within timeout period");
        }
      }

      // Wait for confirmations
      if (confirmations > 1) {
        const currentBlock = await this.web3.eth.getBlockNumber();
        const targetBlock = receipt.blockNumber + confirmations - 1;

        if (currentBlock < targetBlock) {
          logger.info("Waiting for additional confirmations", {
            txHash,
            currentBlock,
            targetBlock,
            confirmations,
          });

          // Poll until target block is reached
          while ((await this.web3.eth.getBlockNumber()) < targetBlock) {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
          }
        }
      }

      logger.info("Transaction confirmed", {
        txHash,
        blockNumber: receipt.blockNumber,
        confirmations,
      });

      return receipt;
    } catch (error) {
      logger.error("Failed to wait for transaction confirmation", {
        error: error.message,
        txHash,
        confirmations,
      });
      throw error;
    }
  }

  /**
   * Get transaction details
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction details
   */
  async getTransaction(txHash) {
    try {
      const tx = await this.web3.eth.getTransaction(txHash);
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);

      return {
        transaction: tx,
        receipt: receipt,
      };
    } catch (error) {
      logger.error("Failed to get transaction details", {
        error: error.message,
        txHash,
      });
      throw error;
    }
  }
}

module.exports = PlasmaClient;
