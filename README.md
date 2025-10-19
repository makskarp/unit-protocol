# Hyperunit XPL Depositor

A Node.js script for sending XPL on the Plasma network using the Hyperunit protocol API to generate deposit addresses and monitor the complete deposit lifecycle.

## Features

- 🚀 **Generate Deposit Addresses**: Uses Hyperunit API to generate unique deposit addresses
- 💸 **Send XPL Transactions**: Sends XPL on Plasma network with proper gas management
- 📊 **Monitor UXPL Reception**: Monitors UXPL token reception directly on Hyperliquid chain
- 🔧 **Modular Architecture**: Easy to extend with additional features
- 📝 **Comprehensive Logging**: Detailed logging with Winston
- ⚙️ **Configuration Management**: Environment-based configuration
- 🎯 **CLI Interface**: Easy-to-use command line interface

## UXPL Reception Monitoring

The script monitors UXPL token reception directly on the Hyperliquid chain by:

1. **Checking Clearinghouse State** - Uses Hyperliquid API to check account's spot positions
2. **Monitoring Balance Changes** - Tracks UXPL balance increases in real-time
3. **Detecting Token Reception** - Alerts when ANY UXPL tokens are received (accounting for fees)
4. **Progress Tracking** - Provides real-time progress updates during monitoring

**Note**: The script monitors for any UXPL tokens received, not exact amounts, since network fees will reduce the final amount received.

## Installation

1. Clone or download the project files
2. Install dependencies:

```bash
npm install
```

3. Copy the environment file and configure:

```bash
cp env.example .env
```

4. Edit `.env` file with your configuration:

```env
# Hyperunit Configuration
HYPERUNIT_API_BASE=https://api.hyperunit.xyz

# Plasma Network Configuration
PLASMA_RPC_URL=https://rpc.plasma.to
PLASMA_CHAIN_ID=9745

# Wallet Configuration
PRIVATE_KEY=your_private_key_here
SENDER_ADDRESS=your_sender_address_here

# Transaction Configuration
GAS_LIMIT=21000
GAS_MULTIPLIER=1.2

# Monitoring Configuration
POLL_INTERVAL=30000
MAX_RETRIES=10

# Logging Configuration
LOG_LEVEL=info
```

## Usage

### Command Line Interface

#### Send XPL Deposit

```bash
node index.js deposit <dstAddr> <amount>
```

Example:

```bash
node index.js deposit 0x1234567890abcdef1234567890abcdef12345678 1.5
```

This will:

1. Generate a deposit address using Hyperunit API
2. Send 1.5 XPL to the generated address
3. Monitor the deposit lifecycle until completion

#### Check Balance

```bash
node index.js balance [address]
```

Example:

```bash
node index.js balance
node index.js balance 0x1234567890abcdef1234567890abcdef12345678
```

#### Estimate Fees

```bash
node index.js estimate-fees
```

#### Monitor UXPL Reception

```bash
node index.js monitor <address> [expectedAmount]
node index.js uxpl-balance <address>
```

Examples:

```bash
node index.js monitor 0x1234567890abcdef1234567890abcdef12345678
node index.js monitor 0x1234567890abcdef1234567890abcdef12345678 1.5
node index.js uxpl-balance 0x1234567890abcdef1234567890abcdef12345678
```

#### Check Withdraw Queue

```bash
node index.js queue
```

### Programmatic Usage

```javascript
const HyperunitXPLDepositor = require("./index");

const depositor = new HyperunitXPLDepositor();

// Send XPL deposit
const result = await depositor.executeDeposit({
  dstAddr: "0x1234567890abcdef1234567890abcdef12345678",
  amount: "1.5",
  onStageChange: (stage, operation, previousStage) => {
    console.log(`Stage: ${stage}`);
  },
  onProgress: (progress, message) => {
    console.log(`${message} (${progress}%)`);
  },
});

console.log("Deposit completed:", result);

// Check balance
const balance = await depositor.getBalance();
console.log(`Balance: ${balance} XPL`);

// Monitor UXPL reception
const monitoringResult = await depositor.monitorDeposit({
  address: "0x1234567890abcdef1234567890abcdef12345678",
  expectedAmount: "1.5",
  onProgress: (progress, message) => console.log(`${message} (${progress}%)`),
});
```

## Configuration

### Environment Variables

| Variable             | Description                         | Default                     |
| -------------------- | ----------------------------------- | --------------------------- |
| `HYPERUNIT_API_BASE` | Hyperunit API base URL              | `https://api.hyperunit.xyz` |
| `PLASMA_RPC_URL`     | Plasma network RPC URL              | `https://rpc.plasma.to`     |
| `PLASMA_CHAIN_ID`    | Plasma network Chain ID             | `9745`                      |
| `PRIVATE_KEY`        | Your wallet private key             | Required                    |
| `SENDER_ADDRESS`     | Your sender address                 | Required                    |
| `GAS_LIMIT`          | Gas limit for transactions          | `21000`                     |
| `GAS_MULTIPLIER`     | Gas price multiplier                | `1.2`                       |
| `POLL_INTERVAL`      | Monitoring poll interval (ms)       | `30000`                     |
| `MAX_RETRIES`        | Maximum monitoring retries          | `10`                        |
| `INITIAL_WAIT_TIME`  | Initial wait before monitoring (ms) | `60000`                     |
| `LOG_LEVEL`          | Logging level                       | `info`                      |

### Network Configuration

- **Plasma Network RPC**: `https://rpc.plasma.to`
- **Chain ID**: `9745`
- **Minimum XPL Deposit**: 0.2 XPL (as per Hyperunit documentation)

## Architecture

The project is structured with clean, modular components:

- **`config.js`** - Configuration management with environment variables
- **`logger.js`** - Winston logging setup
- **`hyperunit-client.js`** - Hyperunit API client for address generation and fee estimation
- **`plasma-client.js`** - Plasma network Web3 client for XPL transactions
- **`hyperliquid-client.js`** - Hyperliquid API client for UXPL balance monitoring
- **`index.js`** - Main application with CLI interface

## Error Handling

The script includes comprehensive error handling:

- **Network connectivity issues** - Graceful handling of API timeouts and connection failures
- **Transaction validation** - Checks for sufficient balance and valid parameters
- **Gas estimation failures** - Automatic retry with fallback gas prices
- **Monitoring timeouts** - Configurable retry limits with clear error messages
- **API response validation** - Validates all API responses before processing

All errors are logged with context and stack traces for easy debugging.

## Logging

Logs are written to:

- Console (with colors)
- `combined.log` (all logs)
- `error.log` (errors only)

Log levels: `error`, `warn`, `info`, `debug`

## Security Considerations

- Never commit your private key to version control
- Use environment variables for sensitive configuration
- Consider using hardware wallets for production use
- Validate all API responses before processing

## Dependencies

- **axios**: HTTP client for Hyperunit and Hyperliquid API requests
- **web3**: Ethereum/Plasma network interaction for XPL transactions
- **dotenv**: Environment variable management
- **winston**: Structured logging framework

## Troubleshooting

### Common Issues

1. **"PRIVATE_KEY environment variable is required"**

   - Make sure your `.env` file exists and contains your private key

2. **"Insufficient balance"**

   - Ensure your account has enough XPL for the transaction amount plus gas fees

3. **"Transaction not mined within timeout period"**

   - The Plasma network might be congested, try increasing gas price

4. **"Monitoring timeout"**

   - The deposit might take longer than expected, increase `MAX_RETRIES` or `POLL_INTERVAL`

5. **"UXPL monitoring timeout"**
   - The UXPL tokens might take longer to arrive on Hyperliquid
   - Increase `MAX_RETRIES` or `POLL_INTERVAL` in your `.env` file
   - Check if the deposit address was generated correctly

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=debug` in your `.env` file.

## Contributing

This script is designed to be easily extensible. You can add new features by:

1. Adding new methods to the client classes
2. Extending the CLI interface in `index.js`
3. Adding new monitoring stages in `deposit-monitor.js`
4. Implementing additional network support

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

- Check the logs for detailed error information
- Verify your configuration matches the requirements
- Ensure your network connectivity is stable
- Review the Hyperunit documentation for API changes
