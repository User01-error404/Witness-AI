require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * Hardhat config for the Witness project.
 * Network details for Monad Testnet (verified June 2026):
 *   RPC URL:  https://testnet-rpc.monad.xyz
 *   Chain ID: 10143
 *   Explorer: https://testnet.monadexplorer.com
 *
 * Put your wallet's private key in a .env file (NEVER commit this file):
 *   PRIVATE_KEY=your_metamask_private_key_without_0x_prefix
 */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
