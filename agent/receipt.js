const { ethers } = require("ethers");

/**
 * Builds a "decision receipt" — a structured, deterministic JSON record
 * of one decision an AI agent made — and computes its keccak256 hash.
 *
 * IMPORTANT: For the hash to be reproducible later (so verification works),
 * we must always serialize fields in the SAME order every time. That's why
 * we build the object with an explicit key order here rather than just
 * spreading whatever the caller passes in.
 */
function buildReceipt({ agentId, task, inputSeen, reasoningSummary, decision, timestamp }) {
  const receipt = {
    agent_id: agentId,
    task,
    input_seen: inputSeen,
    reasoning_summary: reasoningSummary,
    decision,
    timestamp: timestamp ?? Math.floor(Date.now() / 1000)
  };

  const canonicalJson = JSON.stringify(receipt); // consistent key order = consistent hash
  const contentHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));

  return { receipt, canonicalJson, contentHash };
}

/**
 * Re-hashes a receipt object the same way buildReceipt does, so it can be
 * compared against what's on-chain. Used by the verify endpoint.
 */
function hashReceipt(receipt) {
  // Re-build in the exact same key order to guarantee a matching hash.
  const canonicalJson = JSON.stringify({
    agent_id: receipt.agent_id,
    task: receipt.task,
    input_seen: receipt.input_seen,
    reasoning_summary: receipt.reasoning_summary,
    decision: receipt.decision,
    timestamp: receipt.timestamp
  });
  return ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));
}

module.exports = { buildReceipt, hashReceipt };
