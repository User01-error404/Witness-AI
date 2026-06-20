require("dotenv").config();
const OpenAI = require("openai");
const { ethers } = require("ethers");
const { buildReceipt } = require("./receipt");
const WitnessArtifact = require("../artifacts/contracts/Witness.sol/Witness.json");

/**
 * DEMO AGENT
 * -----------
 * A tiny "shopping agent" that picks the best laptop from a short list
 * based on a budget. This stands in for any real agent (trading, expense
 * approval, customer service, etc) — the point isn't the task, it's that
 * EVERY decision gets turned into a receipt and sealed on-chain.
 *
 * Swap PRODUCTS / the prompt for whatever task fits your demo best.
 */

const PRODUCTS = [
  { name: "Laptop A", price: 950, ram: "16GB", cpu: "Mid-tier", battery: "8hr" },
  { name: "Laptop B", price: 880, ram: "16GB", cpu: "Top-tier", battery: "10hr" },
  { name: "Laptop C", price: 1050, ram: "32GB", cpu: "Top-tier", battery: "6hr" },
  { name: "Laptop D", price: 700, ram: "8GB", cpu: "Entry-level", battery: "9hr" }
];

const BUDGET = 1000;

async function runAgentDecision() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const inputSeen = `Budget: $${BUDGET}. Options: ${JSON.stringify(PRODUCTS)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a purchasing agent. Given a budget and a list of laptops, " +
          "pick exactly one. Respond ONLY with JSON: " +
          '{"decision": "<laptop name>", "reasoning_summary": "<one sentence why>"}'
      },
      { role: "user", content: inputSeen }
    ],
    response_format: { type: "json_object" }
  });

  const raw = completion.choices[0].message.content;
  const parsed = JSON.parse(raw);

  // Build the structured, hashable receipt for this decision.
  const { receipt, contentHash } = buildReceipt({
    agentId: "demo-shopping-agent",
    task: `Pick best laptop under $${BUDGET}`,
    inputSeen,
    reasoningSummary: parsed.reasoning_summary,
    decision: parsed.decision
  });

  console.log("Agent decided:", receipt.decision);
  console.log("Reasoning:", receipt.reasoning_summary);
  console.log("Content hash:", contentHash);

  return { receipt, contentHash };
}

/**
 * Sends the receipt's hash to the Witness contract on Monad testnet,
 * then saves the full receipt locally (this is what the verify page
 * will fetch and re-hash later).
 */
async function logToChain(receipt, contentHash) {
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, WitnessArtifact.abi, wallet);

  const tx = await contract.logReceipt(contentHash, receipt.task.slice(0, 64));
  console.log("Transaction sent:", tx.hash);
  const txReceipt = await tx.wait();
  console.log("Confirmed in block:", txReceipt.blockNumber);

  // The receipt ID is the receiptCount value BEFORE this tx (events give us the real ID)
  const event = txReceipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === "ReceiptLogged");

  const receiptId = event.args.id.toString();
  console.log("On-chain receipt ID:", receiptId);

  return { txHash: tx.hash, receiptId, blockNumber: txReceipt.blockNumber };
}

async function main() {
  const { receipt, contentHash } = await runAgentDecision();
  const chainResult = await logToChain(receipt, contentHash);

  // Save the full receipt + chain proof to local storage so the
  // server/verify page can fetch it later.
  const fs = require("fs");
  const path = require("path");
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  const dataFile = path.join(dataDir, "receipts.json");

  const existing = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile)) : [];
  existing.push({
    ...receipt,
    contentHash,
    ...chainResult
  });
  fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2));

  console.log("\nSaved to data/receipts.json — ready to verify on the frontend.");
}

main().catch((err) => {
  console.error("Agent run failed:", err);
  process.exitCode = 1;
});
