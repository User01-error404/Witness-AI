# Witness — On-Chain Accountability Layer for AI Agents

Every decision an AI agent makes gets turned into a structured "receipt,"
hashed, and sealed on Monad testnet. Anyone can later re-hash the original
record and check it still matches — proving it wasn't edited after the fact.

## Project layout

```
witness/
  contracts/Witness.sol      <- the smart contract (deployed to Monad testnet)
  scripts/deploy.js          <- deploys the contract
  agent/receipt.js           <- builds + hashes decision receipts
  agent/run-agent.js         <- the demo AI agent (calls OpenAI, logs to chain)
  server/index.js            <- API: list receipts, verify, trust score
  data/receipts.json         <- local storage of full receipts (auto-created)
  .env.example                <- copy to .env and fill in
```

## One-time setup (run these on YOUR machine, not in this sandbox)

### 1. Install dependencies
```bash
cd witness
npm install
```

### 2. Set up your wallet
- Install MetaMask if you don't have it.
- Add Monad Testnet manually:
  - Network Name: Monad Testnet
  - RPC URL: https://testnet-rpc.monad.xyz
  - Chain ID: 10143
  - Currency Symbol: MON
  - Block Explorer: https://testnet.monadexplorer.com
- Get testnet MON from the official Monad faucet (search "Monad testnet faucet" —
  some faucets require a small mainnet ETH balance on your wallet, so check
  the requirements on whichever faucet you use).
- Export your private key: MetaMask -> Account Details -> Show Private Key.
  **Never share this or commit it.**

### 3. Configure environment variables
```bash
cp .env.example .env
```
Fill in:
- `PRIVATE_KEY` — your wallet's private key (no `0x` prefix)
- `OPENAI_API_KEY` — your OpenAI key (or swap agent/run-agent.js to use Anthropic)
- `CONTRACT_ADDRESS` — leave blank for now, fill in after deploying

### 4. Compile and deploy the contract
```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network monadTestnet
```
Copy the printed contract address into `.env` as `CONTRACT_ADDRESS`.

### 5. Run the agent (produces a decision + logs it on-chain)
```bash
node agent/run-agent.js
```
This will:
1. Ask GPT to pick a laptop within budget
2. Build a structured receipt + hash it
3. Send the hash to your deployed contract on Monad
4. Save the full receipt to `data/receipts.json`

Run it a few times before your demo so you have multiple receipts to show.

### 6. Start the API server
```bash
node server/index.js
```
Runs on `http://localhost:3001`. Endpoints:
- `GET /api/receipts` — list all receipts
- `GET /api/receipts/:id` — one receipt
- `POST /api/verify` — re-hash + check against chain (the demo endpoint)
- `GET /api/trust/:agentAddress` — trust score

### 7. Build the frontend (next step — see below)
A simple page that:
- Lists receipts in a table
- Lets you click one to see its full reasoning trace
- Has a "Verify" button that calls `/api/verify` and shows ✅ or ❌
- Has an editable text field so you can tamper with a receipt live and
  watch verification fail — this is your demo's best moment

## The live demo script (rehearse this)

1. Show the receipts table — "every decision our agent makes gets sealed here."
2. Click a receipt, click Verify — green check, "untampered."
3. Edit one word in the decision (e.g. change the chosen laptop).
4. Click Verify again — red flag, "the chain caught it instantly."
5. Close with the trust score: "imagine this scaling to every trade, every
   payment, every agent action — this is the seatbelt for the agent economy."

## Why Monad specifically

Monad's ~1 second block times and low gas costs mean we can afford to seal
**every single decision**, not just final outcomes — something that would be
too slow/expensive on most other chains. That's the actual technical reason
this is built here, not just "because it's the hackathon chain."
