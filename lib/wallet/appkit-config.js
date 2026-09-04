/**
 * Reown AppKit + wagmi adapter — the connect modal and the wagmi state tree,
 * lifted from ArtifactX (utils/wallet/appkit-config.js) so both sites offer
 * the same wallets the same way: MetaMask and Coinbase listed, the
 * WalletConnect QR as the fallback for everything else.
 *
 * Client only. next.config.js aliases every @reown/* package to `false` for
 * the server bundle, so nothing here may run during SSR — every export guards
 * on `window`, and callers reach this module through a dynamic import.
 *
 * Without NEXT_PUBLIC_REOWN_PROJECT_ID there is no AppKit; the site falls back
 * to wagmi's injected connector so a browser wallet still works. A missing
 * variable degrades, it does not break.
 */
"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { connect as wagmiConnect, disconnect as wagmiDisconnect, getAccount } from "@wagmi/core";
import { REOWN_PROJECT_ID, SUPPORTED_CHAINS, chain } from "./wagmi-config";
import { RPC_URL } from "../mint";

/* Pinned to the top of the picker. Reown's own ordering is driven by its
 * recommendation analytics and surfaces a long tail that reads as spam, so
 * these two lead — but they no longer EXCLUDE (see allWallets below). */
const METAMASK = "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96";
const COINBASE = "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa";

/* WalletConnect verifies metadata.url against the page origin and flags a
 * mismatch in the wallet, so it is read from the page rather than hardcoded. */
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");

const METADATA = () => ({
  name: "TERMINL",
  description: "2048 generative CRT terminals on Robinhood Chain.",
  url: siteUrl(),
  icons: [`${siteUrl()}/apple-touch-icon.png`],
  /* The way back. A mobile wallet that has just signed has no idea where the
   * request came from unless the session says so, which is how someone ends up
   * approving a mint and then staring at their wallet wondering if it worked.
   * Universal only — there is no native app to claim a custom scheme. */
  redirect: { universal: siteUrl() },
});

/* The modal follows the page: CRT green on near-black, square corners,
 * monospace. Variables that AppKit exposes are the only ones that exist. */
const THEME = {
  "--w3m-accent": "#7dff5c",
  "--w3m-color-mix": "#060907",
  "--w3m-color-mix-strength": 40,
  "--w3m-border-radius-master": "0px",
  /* Both spellings: --apkt-* is the current token and --w3m-* the legacy one
   * it falls back to. Either alone suppresses AppKit's own KHTeka @font-face,
   * which is what we want — the modal should read as part of the page, not as
   * a component dropped onto it. The mono token AppKit leaves behind is
   * handled in globals.css. */
  "--apkt-font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  "--w3m-font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  "--w3m-font-size-master": "9px",
  // Above the sticky nav (50) and the CRT scanline layer (60).
  "--w3m-z-index": 1000,
};

let adapter = null;
let kit = null;
let fallbackConfig = null;
let openPromise = null;

const isBrowser = () => typeof window !== "undefined";

const getAdapter = () => {
  if (!isBrowser() || !REOWN_PROJECT_ID) return null;
  if (!adapter) {
    // No `customRpcUrls` here — the chain definition already carries the RPC,
    // and ArtifactX found a partial map breaks the WalletConnect connector.
    adapter = new WagmiAdapter({ networks: SUPPORTED_CHAINS, projectId: REOWN_PROJECT_ID, ssr: true });
  }
  return adapter;
};

/** The AppKit instance, or null when no project id is configured. */
export const getAppKit = () => {
  const a = getAdapter();
  if (!a) return null;
  if (!kit) {
    kit = createAppKit({
      adapters: [a],
      networks: SUPPORTED_CHAINS,
      defaultNetwork: chain,
      projectId: REOWN_PROJECT_ID,
      metadata: METADATA(),
      features: { analytics: false, email: false, socials: false, onramp: false, swaps: false },
      /*
       * Featured, not exclusive.
       *
       * This was `includeWalletIds` + `allWallets: "HIDE"`, lifted from
       * ArtifactX: MetaMask and Coinbase listed, everything else unreachable.
       * On a desktop that is survivable, because the WalletConnect QR is the
       * modal's built-in fallback and any wallet can scan it.
       *
       * On a phone there is no QR to scan — the visitor IS the phone — so
       * connecting means deep-linking into an installed wallet, and the only
       * wallets it will deep-link into are the listed ones. Rainbow, Trust,
       * Phantom, Zerion, Ledger Live, Uniswap: every one of them a dead end,
       * at the exact moment someone is trying to buy.
       *
       * So the two stay pinned to the top, and everyone else can still get in.
       */
      featuredWalletIds: [METAMASK, COINBASE],
      allWallets: "SHOW",
      experimental_preferUniversalLinks: true,
      themeMode: "dark",
      themeVariables: THEME,
    });
  }
  return kit;
};

/**
 * The wagmi config the provider should use once the client is up: the
 * adapter's (it holds AppKit's connectors), or a plain injected-only config
 * when AppKit is not available.
 */
export const getWagmiConfig = () => {
  if (!isBrowser()) return null;
  const a = getAdapter();
  if (a) return a.wagmiConfig;
  if (!fallbackConfig) {
    fallbackConfig = createConfig({
      chains: SUPPORTED_CHAINS,
      connectors: [injected()],
      transports: { [chain.id]: http(RPC_URL) },
      ssr: true,
    });
  }
  return fallbackConfig;
};

export const hasAppKit = () => !!getAppKit();

/**
 * Open the wallet picker (or, with `{ view: "Account" }`, the connected
 * account sheet with its disconnect button). Coalesces concurrent calls the
 * way ArtifactX does — a double tap must not open two modals.
 *
 * Without AppKit this connects the injected provider directly and throws a
 * readable error when there is none.
 */
export const openWallet = async (options) => {
  if (!isBrowser()) return;
  if (openPromise) return openPromise;

  openPromise = (async () => {
    const k = getAppKit();
    if (k) {
      await k.open(options);
      return;
    }
    const config = getWagmiConfig();
    if (options?.view === "Account") {
      await wagmiDisconnect(config);
      return;
    }
    if (!window.ethereum) {
      throw new Error("No wallet found. Install a browser wallet, or open this page in your wallet's browser.");
    }
    await wagmiConnect(config, { connector: injected(), chainId: chain.id });
  })().finally(() => { openPromise = null; });

  return openPromise;
};

/**
 * A link that puts the connected mobile wallet in the foreground, or null.
 *
 * On a phone the transaction request travels over the WalletConnect relay and
 * the wallet only shows it once the app is open, so something has to bring it
 * forward. The automatic hand-off is unreliable — iOS only allows an app switch
 * while a tap is still "active", and a pending request is not a tap — so the
 * panel offers this as a link the user can press themselves. That press is a
 * fresh gesture, which is exactly what the OS wants.
 *
 * The session's own peer metadata is the source: it is the wallet telling us
 * how to reach it. Null for an injected wallet or an in-wallet browser, where
 * the prompt appears in the page and there is nothing to switch to.
 */
export const walletDeepLink = async () => {
  try {
    const { connector } = getAccount(getWagmiConfig());
    const provider = await connector?.getProvider?.();
    const redirect = provider?.session?.peer?.metadata?.redirect;
    return redirect?.native || redirect?.universal || null;
  } catch {
    return null;
  }
};

export const closeWallet = async () => {
  const k = isBrowser() ? getAppKit() : null;
  if (k) await k.close();
};

/* Eager init on the client so the adapter's wagmiConfig exists before
 * WalletProviders asks for it. */
if (isBrowser()) getAppKit();
