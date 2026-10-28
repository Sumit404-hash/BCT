import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import {
  type Candidate,
  type ContractConfig,
  type VoteRecord,
  formatDate,
  getContract,
  isConfigured,
  loadConfig,
  readElection,
  shortenAddress,
} from "./lib/voting";

interface ElectionState {
  candidates: Candidate[];
  closed: boolean;
  totalVotes: number;
  owner: string;
  votes: VoteRecord[];
}

const emptyElection: ElectionState = {
  candidates: [],
  closed: false,
  totalVotes: 0,
  owner: "",
  votes: [],
};

function errorText(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && error.code === 4001) {
    return "The request was rejected in your wallet.";
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

export default function App() {
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [isSepolia, setIsSepolia] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [election, setElection] = useState<ElectionState>(emptyElection);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const configured = useMemo(() => config !== null && isConfigured(config), [config]);

  const refresh = useCallback(async () => {
    if (!config || !configured) return;
    setLoading(true);
    try {
      const state = await readElection(config, provider ?? undefined);
      setElection(state);
      if (account) {
        const reader = provider ?? new BrowserProvider(window.ethereum!);
        const contract = getContract(config, reader);
        setHasVoted(Boolean(await contract.hasVoted(account)));
      } else {
        setHasVoted(false);
      }
      setError("");
    } catch (reason) {
      setError(`Unable to read election data: ${errorText(reason)}`);
    } finally {
      setLoading(false);
    }
  }, [account, config, configured, provider]);

  useEffect(() => {
    loadConfig()
      .then(setConfig)
      .catch((reason: unknown) => setError(`Unable to load public/contract-config.json: ${errorText(reason)}`));
  }, []);

  useEffect(() => {
    if (!configured) return;
    void refresh();
  }, [configured, refresh]);

  useEffect(() => {
    if (!window.ethereum) return;
    const browserProvider = new BrowserProvider(window.ethereum);
    setProvider(browserProvider);

    const checkNetwork = async () => {
      const chainId = await window.ethereum?.request({ method: "eth_chainId" });
      setIsSepolia(String(chainId).toLowerCase() === config?.chainId.toLowerCase());
    };

    const onAccountsChanged = (accounts: unknown) => {
      const next = Array.isArray(accounts) ? accounts[0] : undefined;
      setAccount(typeof next === "string" ? next : null);
    };
    const onChainChanged = () => window.location.reload();

    void checkNetwork().catch((reason: unknown) => setError(errorText(reason)));
    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);
    return () => {
      window.ethereum?.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener("chainChanged", onChainChanged);
    };
  }, [config]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("MetaMask was not detected. Install it to use this Sepolia demonstration.");
      return;
    }
    try {
      setError("");
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      if (accounts[0]) {
        setProvider(browserProvider);
        setAccount(String(accounts[0]));
      }
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      setIsSepolia(String(chainId).toLowerCase() === config?.chainId.toLowerCase());
    } catch (reason) {
      setError(errorText(reason));
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum || !config) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: config.chainId }],
      });
    } catch (reason) {
      setError(errorText(reason));
    }
  };

  const submitVote = async () => {
    if (!config || !provider || !account || selectedCandidate === null) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const signer = await provider.getSigner();
      const contract = getContract(config, signer);
      const transaction = await contract.vote(selectedCandidate);
      setMessage(`Vote submitted: ${transaction.hash}`);
      const receipt = await transaction.wait(1);
      if (!receipt || receipt.status !== 1) throw new Error("The vote transaction did not confirm successfully.");
      setMessage(`Vote confirmed: ${transaction.hash}`);
      await refresh();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setWorking(false);
    }
  };

  const closeElection = async () => {
    if (!config || !provider || !account || account.toLowerCase() !== election.owner.toLowerCase()) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const signer = await provider.getSigner();
      const contract = getContract(config, signer);
      const transaction = await contract.closeElection();
      await transaction.wait(1);
      setMessage(`Election closed. Transaction: ${transaction.hash}`);
      await refresh();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setWorking(false);
    }
  };

  const isOwner = Boolean(account && election.owner && account.toLowerCase() === election.owner.toLowerCase());

  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="OpenBallot home">
          <span className="brand-mark">O</span>
          <span>OpenBallot <small>DEMO</small></span>
        </a>
        <div className="wallet-actions">
          {account ? (
            <span className="account-pill">{shortenAddress(account)}</span>
          ) : (
            <button className="button button-dark" onClick={connectWallet}>Connect wallet</button>
          )}
          {account && !isSepolia && (
            <button className="button button-outline" onClick={switchNetwork}>Switch to Sepolia</button>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow"><span className="status-dot" /> EDUCATIONAL BLOCKCHAIN VOTING</p>
          <h1>Every vote recorded.<br /><span>Every result verifiable.</span></h1>
          <p className="hero-copy">
            Explore a single-election voting flow on Ethereum Sepolia. Connect a wallet, cast one test vote,
            and inspect the public on-chain tally.
          </p>
          <div className="warning" role="note">
            <strong>Demo only—not for real elections.</strong> Votes and wallet addresses are public on-chain.
            This prototype is not anonymous, identity-verified, or resistant to one person using multiple wallets.
            Never enter real voter or sensitive personal information.
          </div>
        </section>

        {!configured && (
          <section className="setup-card">
            <strong>Contract deployment required</strong>
            <p>Deploy <code>contracts/Voting.sol</code> on Sepolia with at least two candidate names, then set the deployed address in <code>public/contract-config.json</code>.</p>
          </section>
        )}
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {message && <div className="notice notice-success" role="status">{message}</div>}

        <section className="section-heading">
          <div>
            <p className="eyebrow">CURRENT BALLOT</p>
            <h2>Cast your vote</h2>
          </div>
          <span className={`state-badge ${election.closed ? "closed" : "open"}`}>
            {election.closed ? "Voting closed" : "Voting open"}
          </span>
        </section>

        <section className="content-grid">
          <div className="ballot-card">
            {election.candidates.length === 0 ? (
              <div className="empty">
                {configured ? (loading ? "Loading ballot…" : "No candidates are available.") : "The ballot will appear after contract deployment."}
              </div>
            ) : (
              <>
                <div className="candidate-list">
                  {election.candidates.map((candidate) => (
                    <button
                      className={`candidate ${selectedCandidate === candidate.index ? "selected" : ""}`}
                      key={candidate.index}
                      onClick={() => setSelectedCandidate(candidate.index)}
                      disabled={election.closed || hasVoted || !isSepolia}
                    >
                      <span className="radio-mark">{selectedCandidate === candidate.index ? "✓" : ""}</span>
                      <span className="candidate-name">{candidate.name}</span>
                      <span className="candidate-votes">{candidate.voteCount} votes</span>
                    </button>
                  ))}
                </div>
                <div className="ballot-footer">
                  {hasVoted ? (
                    <p className="inline-status">Your connected wallet has already voted.</p>
                  ) : election.closed ? (
                    <p className="inline-status">This ballot is closed.</p>
                  ) : !account ? (
                    <button className="button button-primary" onClick={connectWallet}>Connect wallet to vote</button>
                  ) : !isSepolia ? (
                    <button className="button button-primary" onClick={switchNetwork}>Switch to Sepolia to vote</button>
                  ) : (
                    <button className="button button-primary" disabled={selectedCandidate === null || working} onClick={submitVote}>
                      {working ? "Confirming…" : "Submit vote"}
                    </button>
                  )}
                  <span className="gas-note">Wallet confirmation required · Sepolia test ETH</span>
                </div>
              </>
            )}
          </div>

          <aside className="results-card">
            <div className="results-title"><div><p className="eyebrow">LIVE TALLY</p><h3>Results</h3></div><span className="live-dot" /></div>
            <p className="total-votes">{election.totalVotes}<span> total votes</span></p>
            <div className="result-list">
              {election.candidates.map((candidate) => {
                const percent = election.totalVotes > 0 ? Math.round((candidate.voteCount / election.totalVotes) * 100) : 0;
                return (
                  <div className="result-row" key={candidate.index}>
                    <div className="result-label"><span>{candidate.name}</span><strong>{candidate.voteCount} · {percent}%</strong></div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
                  </div>
                );
              })}
            </div>
            {isOwner && !election.closed && (
              <button className="button button-outline close-button" disabled={working} onClick={closeElection}>
                Close election
              </button>
            )}
          </aside>
        </section>

        <section className="history-section">
          <div className="section-heading history-heading">
            <div><p className="eyebrow">PUBLIC AUDIT TRAIL</p><h2>Recent votes</h2></div>
            <button className="button button-outline" onClick={() => void refresh()} disabled={!configured || loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {election.votes.length === 0 ? (
            <div className="empty history-empty">Confirmed vote events will appear here.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Voter address</th><th>Choice</th><th>Time</th><th>Block</th><th>Transaction</th></tr></thead>
                <tbody>
                  {election.votes.map((vote) => (
                    <tr key={vote.transactionHash}>
                      <td><code title={vote.voter}>{shortenAddress(vote.voter)}</code></td>
                      <td>{election.candidates[vote.candidateIndex]?.name ?? `Candidate ${vote.candidateIndex + 1}`}</td>
                      <td>{formatDate(vote.timestamp)}</td>
                      <td>{vote.blockNumber}</td>
                      <td><a href={`${config?.blockExplorerUrl}/tx/${vote.transactionHash}`} target="_blank" rel="noreferrer">View ↗</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="principles">
          <article><span>01</span><h3>Wallet eligibility</h3><p>The contract limits each wallet address to one vote. It does not verify a person’s identity or prevent multiple wallets.</p></article>
          <article><span>02</span><h3>Public by design</h3><p>Votes, addresses, and tallies are observable on a public blockchain. This is not a secret ballot.</p></article>
          <article><span>03</span><h3>Test network only</h3><p>Sepolia test ETH has no intended real-world value. This application is for learning and demonstration.</p></article>
        </section>
      </main>
      <footer><span>OpenBallot · Educational e-voting dApp</span><span>Ethereum Sepolia · Non-binding demonstration</span></footer>
    </div>
  );
}
