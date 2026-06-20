// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Witness
/// @notice An on-chain accountability layer for AI agents.
///         Every decision an agent makes is hashed off-chain, then the
///         hash is "sealed" here permanently. Anyone can later re-hash
///         the original decision record and check it still matches —
///         proving the record was never edited after the fact.
contract Witness {
    struct Receipt {
        bytes32 contentHash; // keccak256 hash of the full decision JSON
        address agent;       // wallet address representing the AI agent
        uint256 timestamp;   // block time the receipt was logged
        string taskLabel;    // short human-readable label, e.g. "laptop-pick-001"
    }

    // receiptId => Receipt
    mapping(uint256 => Receipt) public receipts;
    uint256 public receiptCount;

    // agent address => list of receipt IDs it has logged
    mapping(address => uint256[]) public receiptsByAgent;

    // agent address => count of receipts that were later flagged/disputed
    mapping(address => uint256) public flaggedCount;

    event ReceiptLogged(
        uint256 indexed id,
        address indexed agent,
        bytes32 contentHash,
        uint256 timestamp,
        string taskLabel
    );

    event ReceiptFlagged(uint256 indexed id, address indexed agent, address indexed flaggedBy);

    /// @notice Seal a new decision receipt on-chain.
    /// @param _contentHash keccak256 hash of the full off-chain decision JSON
    /// @param _taskLabel short label so humans can identify the receipt later
    function logReceipt(bytes32 _contentHash, string calldata _taskLabel) external returns (uint256) {
        uint256 id = receiptCount;

        receipts[id] = Receipt({
            contentHash: _contentHash,
            agent: msg.sender,
            timestamp: block.timestamp,
            taskLabel: _taskLabel
        });

        receiptsByAgent[msg.sender].push(id);
        receiptCount++;

        emit ReceiptLogged(id, msg.sender, _contentHash, block.timestamp, _taskLabel);
        return id;
    }

    /// @notice Re-check a receipt: does this hash match what was sealed on-chain?
    /// @dev Call this with the hash of whatever JSON you currently have — if
    ///      it doesn't match, the record was altered (or never existed).
    function verifyReceipt(uint256 _id, bytes32 _contentHash) external view returns (bool) {
        require(_id < receiptCount, "Receipt does not exist");
        return receipts[_id].contentHash == _contentHash;
    }

    /// @notice Anyone can flag a receipt as disputed (e.g. the agent's
    ///         real-world action didn't match what it claimed it would do).
    ///         This is intentionally open for the hackathon demo; a production
    ///         version would gate this behind staking or a review process.
    function flagReceipt(uint256 _id) external {
        require(_id < receiptCount, "Receipt does not exist");
        address agent = receipts[_id].agent;
        flaggedCount[agent]++;
        emit ReceiptFlagged(_id, agent, msg.sender);
    }

    /// @notice Simple trust score: percentage of an agent's receipts that
    ///         have NOT been flagged. Returns a value 0-100.
    function trustScore(address _agent) external view returns (uint256) {
        uint256 total = receiptsByAgent[_agent].length;
        if (total == 0) return 100; // no history yet -> benefit of the doubt
        uint256 flagged = flaggedCount[_agent];
        if (flagged >= total) return 0;
        return ((total - flagged) * 100) / total;
    }

    /// @notice Get all receipt IDs logged by a given agent.
    function getReceiptsByAgent(address _agent) external view returns (uint256[] memory) {
        return receiptsByAgent[_agent];
    }
}
