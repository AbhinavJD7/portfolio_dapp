/**
 * Solana Blockchain Utilities
 * 
 * This file contains reusable functions for Solana operations.
 * Separating blockchain logic from React components keeps code cleaner
 * and makes it easier to test.
 */

import { Connection, Transaction, PublicKey } from '@solana/web3.js';

/**
 * Estimate the fee for a transaction
 * 
 * How it works:
 * 1. Get the recent blockhash (every block has a unique hash)
 * 2. Simulate the transaction (dry-run without actually sending)
 * 3. Return the fee in lamports (1 SOL = 1e9 lamports)
 */
export async function estimateTransactionFee(
  connection: Connection,
  transaction: Transaction
): Promise<number> {
  try {
    // Get the latest blockhash - required for every Solana transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Simulate the transaction to estimate fees
    const simulationResult = await connection.simulateTransaction(transaction);

    if (simulationResult.value.err) {
      throw new Error(`Simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
    }

    // The fee is calculated based on transaction size and network congestion
    // For now, return a default of 5000 lamports (0.000005 SOL)
    // In production, you'd use the actual fee from the simulation
    return 5000;
  } catch (error) {
    console.error("Fee estimation failed:", error);
    // Default fallback fee
    return 5000;
  }
}

/**
 * Convert lamports to SOL
 * 
 * Blockchain always works with the smallest unit (lamports)
 * 1 SOL = 1,000,000,000 lamports
 * This function makes it human-readable
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1e9;
}

/**
 * Convert SOL to lamports
 * 
 * When sending transactions, we always use lamports
 * This helper converts user-friendly SOL input to lamports
 */
export function solToLamports(sol: number): number {
  return sol * 1e9;
}

/**
 * Validate if a string is a valid Solana wallet address
 * 
 * Solana addresses are:
 * - Base58 encoded
 * - Always 44 characters long (except for shorter system accounts)
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format large numbers with commas for readability
 * Example: 1234567 -> "1,234,567"
 */
export function formatNumber(num: number, decimals: number = 4): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}