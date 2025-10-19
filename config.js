require("dotenv").config();

const config = {
  // Hyperunit Configuration
  hyperunit: {
    apiBase: process.env.HYPERUNIT_API_BASE || "https://api.hyperunit.xyz",
    timeout: 30000,
  },

  // Plasma Network Configuration
  plasma: {
    rpcUrl: process.env.PLASMA_RPC_URL || "https://rpc.plasma.to",
    chainId: parseInt(process.env.PLASMA_CHAIN_ID) || 9745,
    gasLimit: parseInt(process.env.GAS_LIMIT) || 21000,
    gasMultiplier: parseFloat(process.env.GAS_MULTIPLIER) || 1.2,
  },

  // Wallet Configuration
  wallet: {
    privateKey: process.env.PRIVATE_KEY,
    senderAddress: process.env.SENDER_ADDRESS,
  },

  // Monitoring Configuration
  monitoring: {
    pollInterval: parseInt(process.env.POLL_INTERVAL) || 5000, // 5 seconds
    maxRetries: parseInt(process.env.MAX_RETRIES) || 60, // 5 minutes total
    initialWaitTime: parseInt(process.env.INITIAL_WAIT_TIME) || 10000, // 10 seconds
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

// Validation
if (!config.wallet.privateKey) {
  throw new Error("PRIVATE_KEY environment variable is required");
}

if (!config.wallet.senderAddress) {
  throw new Error("SENDER_ADDRESS environment variable is required");
}

module.exports = config;
