/**
 * App.tsx — Main Application Entry
 *
 * 🧠 React Learning Note:
 * React components are just functions that return JSX (HTML-like syntax).
 * Providers are components that share data with all their children
 * without passing props manually every time. Solana uses this pattern
 * for wallet connection state.
 */

import { useEffect, useState, useCallback } from "react";
import { useMemo } from 'react';
import {
  ConnectionProvider,
  useConnection,
  useWallet,
  WalletProvider
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  WalletModalProvider,
  WalletDisconnectButton,
  WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import {
  clusterApiUrl,
  SystemProgram,
  Transaction,
  PublicKey,
  TOKEN_PROGRAM_ID,
} from '@solana/web3.js';
import {
  estimateTransactionFee,
  solToLamports,
  isValidSolanaAddress,
  formatNumber
} from './solana-utils';

import '@solana/wallet-adapter-react-ui/styles.css';
import "./App.css";
import rabbitLogo from "./rabbit.svg";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * 🧠 TypeScript Learning Note:
 * TypeScript lets us define the "shape" of data using types/interfaces.
 * Here we say a status can only be one of these four literal strings.
 */
type StatusType = 'info' | 'success' | 'error' | 'loading';

interface StatusMessage {
  type: StatusType;
  message: string;
}

// ─── StatusAlert Component ────────────────────────────────────────────────────

/**
 * 🧠 React Learning Note:
 * This is a "presentational" component — it only shows UI based on props.
 * It has no state of its own. Props flow DOWN from parent → child.
 */
function StatusAlert({ status }: { status: StatusMessage | null }) {
  if (!status) return null;

  const icons: Record<StatusType, React.ReactNode> = {
    loading: <span className="spinner" aria-hidden="true" />,
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };

  return (
    <div className={`status-alert status-${status.type}`} role="alert">
      <span style={{ fontSize: status.type === 'loading' ? undefined : '14px', fontWeight: 700 }}>
        {icons[status.type]}
      </span>
      {status.message}
    </div>
  );
}

// ─── CopyButton Component ─────────────────────────────────────────────────────

/**
 * 🧠 React Learning Note:
 * useState creates local state that lives inside this component.
 * When state changes, React re-renders just this component.
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // Auto-reset the "copied" state after 1.5 seconds
      setTimeout(() => setCopied(false), 1500);
    } catch {
      console.error("Clipboard write failed");
    }
  };

  return (
    <button
      className="copy-btn"
      onClick={handleCopy}
      title="Copy to clipboard"
      aria-label="Copy address to clipboard"
    >
      {copied ? '✓' : '⎘'}
      {copied && <span className="copied-tip">Copied!</span>}
    </button>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

/**
 * 🧠 Solana Learning Note:
 * Everything on Solana lives on a "network" (cluster):
 *   - Devnet  = sandbox for development, free test SOL via airdrops
 *   - Testnet = pre-production testing
 *   - Mainnet = real money, real transactions
 *
 * We're using Devnet here so you can safely experiment!
 */
export function App() {
  // We use a custom RPC endpoint for better reliability than the default
  const endpoint = "https://devnet.helius-rpc.com/?api-key=ab77d0f0-033d-4753-87a3-ffedebec057a";

  return (
    /**
     * 🧠 Provider Pattern:
     * Providers wrap your app and inject shared context.
     * Any child component can access the wallet/connection
     * using hooks (useWallet, useConnection) without prop drilling.
     */
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <div className="app-container">
            <Topbar />
            <NetworkBadge />
            <main className="main-content" id="main-content">
              <Portfolio />
              <div className="actions-grid">
                <Send />
                <Faucet />
              </div>
            </main>
            <AppFooter />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

/**
 * 🧠 React Learning Note:
 * useWallet() is a custom hook — it "subscribes" to wallet state.
 * When the user connects/disconnects, React automatically re-renders
 * any component that called useWallet().
 */
function Topbar() {
  const { publicKey } = useWallet();

  return (
    <header className="topbar" role="banner">
      <div className="topbar-brand">
        <div className="topbar-logo" aria-hidden="true">
          <img src={rabbitLogo} className="topbar-logo-img" alt="Rabbit Logo" />
        </div>
        <div className="topbar-title-container">
          <span className="brand-name">Rabbit</span>
          <span className="brand-separator">|</span>
          <span className="page-name">Portfolio</span>
        </div>
        <span className="topbar-badge">Devnet</span>
      </div>

      <div className="wallet-controls">
        {/* Conditionally render based on connection state */}
        {!publicKey ? (
          <WalletMultiButton />
        ) : (
          <WalletDisconnectButton />
        )}
      </div>
    </header>
  );
}

// ─── Network Badge ────────────────────────────────────────────────────────────

function NetworkBadge() {
  return (
    <div className="network-bar" aria-label="Network status: Solana Devnet, Connected">
      <span className="network-dot" aria-hidden="true" />
      Solana Devnet — all transactions are free test tokens
    </div>
  );
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

/**
 * 🧠 React + Solana Learning Note:
 * useEffect runs SIDE EFFECTS — code that interacts with the outside world.
 * Here we use it to fetch the wallet balance from the Solana blockchain
 * whenever the public key changes (user connects/disconnects).
 *
 * Solana stores balances in LAMPORTS (like cents to a dollar):
 *   1 SOL = 1,000,000,000 lamports
 */
function Portfolio() {
  const { publicKey } = useWallet();
  const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to fetch balance — wrapped in useCallback so it doesn't
  // recreate on every render (a performance optimization)
  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    setIsRefreshing(true);
    try {
      // getBalance returns lamports, so we divide by 1e9 to get SOL
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / 1e9);
      const tokenAccounts  = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId : TOKEN_PROGRAM_ID
      });
      const parsedTokens = tokenAccounts.value.map((tokenAccountInfo) => {
        const accountData = tokenAccountInfo.account.data.parsed.info;
        return {
          pubkey: tokenAccountInfo.pubkey.toString(),
          mint: accountData.mint,
          balance: accountData.tokenAmount.uiAmount,
          decimals: accountData.tokenAmount.decimals
        };
      });
      setTokens(parsedTokens);
    } catch (err) {
      console.error("Balance fetch failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [publicKey, connection]);

  // 🧠 The dependency array [publicKey, fetchBalance] means:
  //    "re-run this effect whenever publicKey or fetchBalance changes"
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return (
    <section className="portfolio" aria-labelledby="portfolio-heading">
      <div className="portfolio-header">
        <div>
          <h2 id="portfolio-heading">Your Portfolio</h2>
          <p className="portfolio-subtitle">
            {publicKey
              ? "Live data from Solana Devnet"
              : "Connect a wallet to see your assets"}
          </p>
        </div>
        {publicKey && (
          <button
            className="refresh-btn"
            onClick={fetchBalance}
            disabled={isRefreshing}
            title="Refresh balance"
            aria-label="Refresh balance"
          >
            {isRefreshing ? '⟳' : '↻'}
          </button>
        )}
      </div>

      <div className="portfolio-content">
        {publicKey ? (
          <>
            {/* Wallet Address Card */}
            <div className="portfolio-item">
              <label>Wallet Address</label>
              <div className="address-copy-row">
                <code className="address">{publicKey.toString()}</code>
                <CopyButton text={publicKey.toString()} />
              </div>
            </div>

            {/* SOL Balance Card */}
            <div className="portfolio-item">
              <label>SOL Balance</label>
              {balance !== null ? (
                <>
                  <p className="balance">{balance.toFixed(4)}<span style={{ fontSize: '18px', marginLeft: '6px', opacity: 0.7 }}>SOL</span></p>
                  <p className="balance-usd">≈ ${(balance * 180).toFixed(2)} USD</p>
                </>
              ) : (
                <p className="balance" style={{ opacity: 0.5 }}>Loading...</p>
              )}
            </div>

            {/* SPL Tokens Card */}
            {tokens.length > 0 && (
              <div className="portfolio-item" style={{ gridColumn: '1 / -1' }}>
                <label>Your Tokens</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tokens.map((token, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <code className="address" style={{ fontSize: '14px' }}>{token.mint.slice(0, 4)}...{token.mint.slice(-4)}</code>
                      <span className="balance" style={{ fontSize: '18px', margin: 0, padding: 0, background: 'none', WebkitTextFillColor: 'var(--text-primary)' }}>{token.balance}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="placeholder-wrapper">
            <div className="placeholder-icon" aria-hidden="true">◎</div>
            <p className="placeholder">
              <strong>Connect your wallet to get started</strong>
              Click the button in the top-right corner to connect a Solana wallet like Phantom or Backpack.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Send SOL ─────────────────────────────────────────────────────────────────

/**
 * 🧠 Solana Transaction Learning Note:
 * A Solana transaction is like a batch of instructions sent to the network.
 * Here we create a single-instruction transaction using SystemProgram.transfer
 * which is the built-in program for moving SOL between wallets.
 *
 * Flow: Build tx → Sign with wallet → Send to network → Confirm
 */
function Send() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Validate inputs in real-time
  const isAddressValid = !recipientAddress || isValidSolanaAddress(recipientAddress);
  const isAmountValid = !amount || Number(amount) > 0;
  const canSend = publicKey && recipientAddress && amount && isAddressValid && isAmountValid && !isLoading;

  // Estimate fee when inputs are valid
  useEffect(() => {
    if (!recipientAddress || !amount || !isAddressValid || !isAmountValid || !publicKey) {
      setEstimatedFee(null);
      return;
    }

    /**
     * 🧠 Note: We use an inner async function because useEffect's callback
     * cannot itself be async (it needs to return a cleanup function or nothing).
     */
    const estimateFee = async () => {
      try {
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey!,
            toPubkey: new PublicKey(recipientAddress),
            lamports: solToLamports(Number(amount)),
          })
        );
        const fee = await estimateTransactionFee(connection, tx);
        setEstimatedFee(fee);
      } catch {
        setEstimatedFee(5000); // fallback: 0.000005 SOL
      }
    };

    estimateFee();
  }, [recipientAddress, amount, publicKey, connection, isAddressValid, isAmountValid]);

  const handleSend = async () => {
    if (!canSend) return;

    try {
      setIsLoading(true);
      setStatus({ type: 'loading', message: 'Building transaction...' });

      // 🧠 SystemProgram.transfer creates an instruction to move SOL
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(recipientAddress),
          lamports: solToLamports(Number(amount)),
        })
      );

      setStatus({ type: 'loading', message: 'Waiting for wallet signature...' });

      // sendTransaction pops up the wallet modal to approve & sign
      const signature = await sendTransaction(transaction, connection);

      setStatus({
        type: 'loading',
        message: `Confirming on-chain... (${signature.slice(0, 8)}...)`
      });

      // Wait until the network has finalized the transaction
      await connection.confirmTransaction(signature);

      setRecipientAddress("");
      setAmount("");
      setEstimatedFee(null);
      setStatus({ type: 'success', message: `Transaction confirmed! Signature: ${signature.slice(0, 12)}...` });

      setTimeout(() => setStatus(null), 6000);
    } catch (error) {
      console.error("Send failed:", error);
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : "Transaction failed"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="card" aria-labelledby="send-heading">
      <div className="card-icon send" aria-hidden="true">↑</div>
      <h3 id="send-heading">Send SOL</h3>
      <p className="card-hint">Transfer SOL to any Solana wallet address</p>

      <StatusAlert status={status} />

      <div className="form-group">
        <label htmlFor="recipient">Recipient Address</label>
        <input
          id="recipient"
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value.trim())}
          placeholder="Enter Solana wallet address"
          disabled={!publicKey || isLoading}
          className={!isAddressValid && recipientAddress ? 'input-error' : ''}
          aria-invalid={!isAddressValid && !!recipientAddress}
          aria-describedby={!isAddressValid && recipientAddress ? 'recipient-error' : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {!isAddressValid && recipientAddress && (
          <small id="recipient-error" className="error-text">
            Not a valid Solana address (should be 32–44 base58 characters)
          </small>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="send-amount">Amount (SOL)</label>
        <input
          id="send-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          disabled={!publicKey || isLoading}
          min="0"
          step="0.001"
          className={!isAmountValid && amount ? 'input-error' : ''}
          aria-invalid={!isAmountValid && !!amount}
        />
        {!isAmountValid && amount && (
          <small className="error-text">Amount must be greater than 0</small>
        )}
      </div>

      {/* Fee preview — only shown when we have valid inputs */}
      {estimatedFee !== null && amount && (
        <div className="fee-preview" aria-live="polite">
          <div className="fee-row">
            <span>Sending</span>
            <span>{formatNumber(Number(amount), 4)} SOL</span>
          </div>
          <div className="fee-row">
            <span>Network fee</span>
            <span>~{formatNumber(estimatedFee / 1e9, 6)} SOL</span>
          </div>
          <div className="fee-row fee-total">
            <span>Total</span>
            <span>{formatNumber(Number(amount) + estimatedFee / 1e9, 6)} SOL</span>
          </div>
        </div>
      )}

      <button
        id="send-btn"
        onClick={handleSend}
        disabled={!canSend}
        className="btn btn-primary"
        aria-busy={isLoading}
      >
        {isLoading ? 'Processing...' : 'Send SOL →'}
      </button>

      {!publicKey && (
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          Connect wallet to send
        </p>
      )}
    </section>
  );
}

// ─── Faucet / Airdrop ─────────────────────────────────────────────────────────

/**
 * 🧠 Solana Devnet Faucet Learning Note:
 * On devnet, you can request free test SOL using requestAirdrop().
 * This is how you get tokens to test your dApp without real money.
 * Mainnet doesn't have this — airdrops are devnet-only!
 *
 * Rate limits apply: usually max 2 SOL per request, limited per hour.
 */
function Faucet() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [faucetAddress, setFaucetAddress] = useState("");
  const [faucetAmount, setFaucetAmount] = useState("1");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isAddressValid = !faucetAddress || isValidSolanaAddress(faucetAddress);
  const isAmountValid = !faucetAmount || (Number(faucetAmount) > 0 && Number(faucetAmount) <= 2);
  const targetAddress = faucetAddress || publicKey?.toString();
  const canAirdrop = targetAddress && faucetAmount && isAddressValid && isAmountValid && !isLoading;

  const handleAirdrop = async () => {
    if (!targetAddress || !canAirdrop) return;

    try {
      setIsLoading(true);
      setStatus({ type: 'loading', message: 'Requesting airdrop from Solana faucet...' });

      // requestAirdrop sends devnet SOL directly to the address
      const signature = await connection.requestAirdrop(
        new PublicKey(targetAddress),
        solToLamports(Number(faucetAmount))
      );

      setStatus({
        type: 'loading',
        message: `Airdrop sent! Waiting for confirmation... (${signature.slice(0, 8)}...)`
      });

      await connection.confirmTransaction(signature);

      setFaucetAddress("");
      setFaucetAmount("1");
      setStatus({
        type: 'success',
        message: `${faucetAmount} SOL airdropped successfully! Check your portfolio.`
      });

      setTimeout(() => setStatus(null), 6000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";

      if (msg.includes('429') || msg.toLowerCase().includes('rate')) {
        setStatus({
          type: 'error',
          message: 'Rate limited! Wait a few minutes before requesting again.'
        });
      } else if (msg.includes('airdrop')) {
        setStatus({
          type: 'error',
          message: 'Airdrop failed — try requesting a smaller amount (max 2 SOL).'
        });
      } else {
        setStatus({ type: 'error', message: `Error: ${msg}` });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="card" aria-labelledby="faucet-heading">
      <div className="card-icon faucet" aria-hidden="true">⬇</div>
      <h3 id="faucet-heading">Devnet Faucet</h3>
      <p className="card-hint">Get free test SOL for development — max 2 SOL per request</p>

      <StatusAlert status={status} />

      <div className="form-group">
        <label htmlFor="airdrop-address">
          Wallet Address
          {publicKey && !faucetAddress && (
            <span style={{ color: 'var(--sol-green)', fontWeight: 500, marginLeft: 6 }}>
              (using connected wallet)
            </span>
          )}
        </label>
        <input
          id="airdrop-address"
          type="text"
          value={faucetAddress}
          onChange={(e) => setFaucetAddress(e.target.value.trim())}
          placeholder={publicKey?.toString() ?? "Enter wallet address"}
          disabled={isLoading}
          className={!isAddressValid && faucetAddress ? 'input-error' : ''}
          autoComplete="off"
          spellCheck={false}
        />
        {!isAddressValid && faucetAddress && (
          <small className="error-text">Not a valid Solana address</small>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="airdrop-amount">Amount (SOL) — max 2</label>
        <input
          id="airdrop-amount"
          type="number"
          value={faucetAmount}
          onChange={(e) => setFaucetAmount(e.target.value)}
          placeholder="1"
          disabled={isLoading}
          min="0.1"
          max="2"
          step="0.1"
          className={!isAmountValid && faucetAmount ? 'input-error' : ''}
        />
        {!isAmountValid && faucetAmount && (
          <small className="error-text">Amount must be between 0.1 and 2 SOL</small>
        )}
      </div>

      <button
        id="airdrop-btn"
        onClick={handleAirdrop}
        disabled={!canAirdrop}
        className="btn btn-secondary"
        aria-busy={isLoading}
      >
        {isLoading ? 'Requesting...' : `Drop ${faucetAmount || '?'} SOL ↓`}
      </button>

      {!publicKey && !faucetAddress && (
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          Connect a wallet or enter an address above
        </p>
      )}
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function AppFooter() {
  return (
    <footer className="app-footer" role="contentinfo">
      <span>Rabbit Portfolio · Solana Devnet</span>
      <div className="footer-links">
        <a
          href="https://solana.com/developers"
          target="_blank"
          rel="noopener noreferrer"
        >
          Solana Docs
        </a>
        <a
          href="https://explorer.solana.com/?cluster=devnet"
          target="_blank"
          rel="noopener noreferrer"
        >
          Explorer
        </a>
        <a
          href="https://github.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}

export default App;
