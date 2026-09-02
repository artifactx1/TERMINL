/**
 * Chain definitions and the pre-init wagmi config.
 *
 * Same shape as ArtifactX's utils/wallet/wagmi-config.js, cut down to the one
 * chain this drop runs on. The REAL wagmi config is owned by Reown's
 * WagmiAdapter (see appkit-config.js) — that is the one with the connectors.
 * `ssrWagmiConfig` exists so wagmi hooks can render on the server and during
 * the brief client window before the AppKit chunk resolves: same chain, no
 * connectors, so hooks report "disconnected" instead of throwing.
 */
import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { CHAIN, RPC_URL } from "../mint";

/* Robinhood Chain is not in viem/chains, so it is defined from lib/mint.js's
 * table. The explorer matters: wagmi's connectors send it along with
 * wallet_addEthereumChain when a wallet has never heard of the chain. */
export const chain = defineChain({
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Blockscout", url: CHAIN.explorer } },
  ...(CHAIN.id === 46630 ? { testnet: true } : {}),
});

export const SUPPORTED_CHAINS = [chain];

export const REOWN_PROJECT_ID = (process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "").trim();

export const ssrWagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  transports: { [chain.id]: http(RPC_URL) },
  ssr: true,
});
