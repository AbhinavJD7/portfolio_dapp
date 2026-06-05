# Solana Portfolio dApp - Learning Notes

This document tracks the core concepts and technical lessons learned while building out the React-based Solana Portfolio dApp.

## 1. SPL Token Accounts
- **Concept:** Unlike Ethereum where the main wallet holds all tokens, Solana uses separate "Token Accounts" to hold specific SPL tokens (like USDC or BONK). Your main wallet address acts as the "owner" of these Token Accounts.
- **Implementation:** Use `connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })` to fetch all tokens. 
- **Pro-tip:** Always use the `Parsed` version of the fetch method! If you just use `getTokenAccountsByOwner`, you get raw binary data. The `Parsed` version asks the RPC node to decode it into readable JSON.

## 2. Transaction History
- **Concept:** Every on-chain interaction generates a unique Signature (Transaction ID).
- **Implementation:** You can fetch a wallet's recent activity using `connection.getSignaturesForAddress(publicKey, { limit: 10 })`. 
- **Typing:** The API returns an array of `ConfirmedSignatureInfo` objects (which contain the `signature`, `blockTime`, and `err` status). Do not confuse this with the `Transaction` type, which is used strictly for *building* new, un-sent transactions.
- **Timestamps:** Solana returns `blockTime` as a Unix timestamp in seconds. To use it in JavaScript, multiply by 1000: `new Date(tx.blockTime * 1000)`.

## 3. Live Price Feeds
- **Concept:** To calculate real USD values of a portfolio, you need a price feed. You can either use on-chain Oracles (like Pyth Network) or standard Web2 APIs.
- **Implementation:** A simple HTTP `fetch` to CoinGecko's `/simple/price` endpoint is an easy way to get live token prices off-chain.
- **React Integration:** To ensure the price is only fetched once when the app loads (and doesn't spam the API), wrap the `fetch` call in a `useEffect` with an empty dependency array `[]`.
