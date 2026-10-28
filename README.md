# OpenBallot — Educational E-Voting dApp

OpenBallot is a small, non-binding e-voting demonstration for Ethereum Sepolia. It demonstrates wallet-based participation, a one-vote-per-wallet smart-contract rule, an on-chain tally, and public event verification.

> **Not for real elections.** Votes and wallet addresses are public. This prototype is not anonymous, does not verify voter identity or eligibility, and cannot prevent one person from using multiple wallets. Do not enter real voter or sensitive personal information.

## Technology

- React and TypeScript with Vite
- Solidity `^0.8.20`
- ethers.js v6 and MetaMask
- Ethereum Sepolia test network

## Requirements

- Node.js 18 or newer and npm
- MetaMask for wallet-based voting
- Sepolia test ETH for transaction gas

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The page can be explored before deployment, but the live ballot requires a deployed contract.

## Deploy the demo contract

1. Open `contracts/Voting.sol` in Remix and compile with Solidity 0.8.20 or compatible.
2. Connect Remix to MetaMask on Ethereum Sepolia.
3. Deploy `Voting` with a constructor argument containing at least two candidate names, for example `["Candidate A", "Candidate B"]`.
4. Copy the deployed contract address into `public/contract-config.json` as `contractAddress`.
5. Start or refresh the frontend. Confirm the deployment address and network on Sepolia Etherscan before testing.

Do not deploy to mainnet or use real funds. The contract is an educational example, not independently audited.

## Features

- MetaMask connection and Sepolia network check/switch.
- Candidate ballot with one vote per connected wallet address.
- Live candidate tally read from contract state.
- Owner-controlled election closure.
- Public `VoteCast` events with voter address, choice, timestamp, and transaction verification link.

## Manual checks

- Deploy with fewer than two candidates or an empty name; deployment should revert.
- Connect on a non-Sepolia network and verify the app prompts for a network switch.
- Vote once; verify the count changes and the transaction appears in the audit trail.
- Try voting again from the same wallet; the contract should reject it.
- Close the ballot from the owner wallet; subsequent votes should revert.
- Try closing the election from a non-owner wallet; the contract should reject it.
- Verify that the report and UI clearly describe public vote/address visibility and the absence of identity verification.
