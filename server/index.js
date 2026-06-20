require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { hashReceipt } = require("../agent/receipt");
const WitnessArtifact = require("./Witness.json");

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend at http://localhost:3001
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const DATA_FILE = path.join(__dirname, "..", "data", "receipts.json");

function loadReceipts() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function getContract() {
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, WitnessArtifact.abi, provider);
}

// List all receipts (for a dashboard / table view)
app.get("/api/receipts", (req, res) => {
  res.json(loadReceipts());
});

// Get one receipt by its on-chain receiptId
app.get("/api/receipts/:id", (req, res) => {
  const receipts = loadReceipts();
  const found = receipts.find((r) => r.receiptId === req.params.id);
  if (!found) return res.status(404).json({ error: "Receipt not found" });
  res.json(found);
});

/**
 * THE CORE DEMO ENDPOINT.
 * Takes a receipt object (possibly edited by the user in the UI),
 * re-hashes it locally, then asks the on-chain contract whether that
 * hash matches what was sealed at logReceipt() time.
 *
 * This is what lets you, live on stage, change one word in a decision
 * and show the verification flip from ✅ to ❌.
 */
app.post("/api/verify", async (req, res) => {
  try {
    const { receiptId, receiptData } = req.body;
    if (receiptId === undefined || !receiptData) {
      return res.status(400).json({ error: "receiptId and receiptData are required" });
    }

    const recomputedHash = hashReceipt(receiptData);
    const contract = getContract();
    const isValid = await contract.verifyReceipt(receiptId, recomputedHash);

    res.json({
      receiptId,
      recomputedHash,
      verified: isValid,
      message: isValid
        ? "Hash matches the on-chain seal. This record is untampered."
        : "Hash does NOT match the on-chain seal. This record was altered after it was logged."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Trust score for an agent address
app.get("/api/trust/:agentAddress", async (req, res) => {
  try {
    const contract = getContract();
    const score = await contract.trustScore(req.params.agentAddress);
    res.json({ agent: req.params.agentAddress, trustScore: score.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Local dev server
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Witness API running on http://localhost:${PORT}`));
}

// Vercel serverless export
module.exports = app;
