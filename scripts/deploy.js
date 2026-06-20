const hre = require("hardhat");

async function main() {
  console.log("Deploying Witness contract to Monad Testnet...");

  const Witness = await hre.ethers.getContractFactory("Witness");
  const witness = await Witness.deploy();
  await witness.waitForDeployment();

  const address = await witness.getAddress();
  console.log("Witness deployed to:", address);
  console.log("\nNext step: copy this address into your .env file as CONTRACT_ADDRESS");
  console.log("View it on the explorer: https://testnet.monadexplorer.com/address/" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
