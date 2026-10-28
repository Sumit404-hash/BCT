import { BrowserProvider, Contract, JsonRpcProvider, isAddress, type ContractRunner } from "ethers";

export interface ContractConfig {
  contractAddress: string;
  networkName: string;
  chainId: string;
  chainIdDecimal: number;
  rpcUrl: string;
  blockExplorerUrl: string;
}

export interface Candidate {
  index: number;
  name: string;
  voteCount: number;
}

export interface VoteRecord {
  voter: string;
  candidateIndex: number;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

export interface EthereumWallet {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumWallet;
  }
}

const abi = [
  "function owner() view returns (address)",
  "function candidates(uint256) view returns (string name, uint256 voteCount)",
  "function candidateCount() view returns (uint256)",
  "function hasVoted(address) view returns (bool)",
  "function electionClosed() view returns (bool)",
  "function totalVotes() view returns (uint256)",
  "function vote(uint256 candidateIndex)",
  "function closeElection()",
  "event VoteCast(address indexed voter, uint256 indexed candidateIndex, uint256 timestamp)",
  "event ElectionClosedByOwner(address indexed owner, uint256 timestamp)",
];

export async function loadConfig(): Promise<ContractConfig> {
  const response = await fetch("/contract-config.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load contract configuration (${response.status}).`);
  return (await response.json()) as ContractConfig;
}

export function isConfigured(config: ContractConfig): boolean {
  return Boolean(config.contractAddress && isAddress(config.contractAddress));
}

export function getContract(config: ContractConfig, runner: ContractRunner): Contract {
  if (!isConfigured(config)) throw new Error("Deploy Voting.sol and set its address in public/contract-config.json.");
  return new Contract(config.contractAddress, abi, runner);
}

export async function readElection(config: ContractConfig, provider?: BrowserProvider) {
  const runner = provider ?? new JsonRpcProvider(config.rpcUrl);
  const contract = getContract(config, runner);
  const [countValue, closed, totalValue, owner] = await Promise.all([
    contract.candidateCount(),
    contract.electionClosed(),
    contract.totalVotes(),
    contract.owner(),
  ]);
  const count = Number(countValue);
  const candidates: Candidate[] = [];

  for (let index = 0; index < count; index += 1) {
    const candidate = await contract.candidates(index);
    candidates.push({
      index,
      name: String(candidate.name ?? candidate[0]),
      voteCount: Number(candidate.voteCount ?? candidate[1]),
    });
  }

  const filter = contract.filters.VoteCast();
  const latestBlock = await runner.getBlockNumber();
  const logs = await contract.queryFilter(filter, Math.max(0, latestBlock - 20_000), "latest");
  const votes: VoteRecord[] = logs.map((log) => {
    const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) throw new Error(`Could not decode vote event in ${log.transactionHash}.`);
    return {
      voter: String(parsed.args.voter),
      candidateIndex: Number(parsed.args.candidateIndex),
      timestamp: Number(parsed.args.timestamp),
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
    };
  });

  votes.sort((left, right) => right.blockNumber - left.blockNumber);
  return { candidates, closed: Boolean(closed), totalVotes: Number(totalValue), owner: String(owner), votes };
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}
