import { useEffect, useState } from "react";
import React, { useMemo } from 'react';
import { ConnectionProvider, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { UnsafeBurnerWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
    WalletModalProvider,
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

 
import logo from "./logo.svg";
import reactLogo from "./react.svg";

export function App() {
  const endpoint = "https://devnet.helius-rpc.com/?api-key=ab77d0f0-033d-4753-87a3-ffedebec057a"; //slight security issue

  return (
    <ConnectionProvider endpoint={endpoint}> {/*context provider that provides a connection to the Solana blockchain. It takes an endpoint prop which is the URL of the Solana RPC node you want to connect to.*/}
            <WalletProvider wallets={[]} autoConnect> {/*context provider that manages the state of the user's wallet connection. It takes a wallets prop which is an array of wallet adapters that you want to support in your app, and an autoConnect prop which automatically tries to connect to the last used wallet when the app loads.*/}
                <WalletModalProvider> {/*context provider that provides a modal dialog for connecting to wallets. It wraps the components that need access to the wallet connection functionality, such as the WalletMultiButton and WalletDisconnectButton.*/}
                    <Topbar />
                    <Portfolio />

                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
  );
}

function Topbar() {
    const {publicKey} = useWallet();


    return <div style={{display:"flex", justifyContent: "flex-end"}}>
        {!publicKey && <WalletMultiButton />}
        {publicKey && <WalletDisconnectButton />}
    </div>
}

function Portfolio() {
    const {publicKey} = useWallet();
    const {connection} = useConnection();
    //const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=ab77d0f0-033d-4753-87a3-ffedebec057a");
    const [balance, setBalance] = useState<number | null>(null);
    useEffect(() => {
        if (publicKey) {
            connection.getBalance(publicKey).then(balance => {
                setBalance(balance / 1e9);
            });
        }
    }, [publicKey]);
    return <div>
        {publicKey?.toString() || "Please connect your wallet to view your portfolio."}
        {balance !== null && <p>Balance: {balance.toFixed(4)} SOL</p>}
    </div>
}

export default App;
