"use client";

import { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { hydrate } from "@wagmi/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ssrWagmiConfig } from "../lib/wallet/wagmi-config";

/*
 * Always renders WagmiProvider, so wagmi hooks never throw:
 *
 *   1. Server and first client render: `ssrWagmiConfig` — the chain, no
 *      connectors. Hooks report "disconnected".
 *   2. Once the AppKit chunk resolves on the client: swap in the adapter's
 *      config, where the connectors live, so the connection state propagates.
 *
 * The chunk download starts at MODULE EVALUATION below, not in an effect — on
 * a phone, hydration takes seconds, and waiting for an effect to even begin
 * the download pushed "Connect responds" further out on ArtifactX.
 *
 * The swap changes the `config` prop, not the provider `key`. WagmiProvider is
 * a plain context provider, so hooks re-subscribe without a remount; what a
 * remount would have given us — wagmi's Hydrate.onMount, which restores the
 * persisted session — is called by hand before the swap.
 */
const appkitModulePromise =
  typeof window !== "undefined" ? import("../lib/wallet/appkit-config") : null;

const queryClient = new QueryClient();

export default function WalletProviders({ children }) {
  const [config, setConfig] = useState(ssrWagmiConfig);

  useEffect(() => {
    let cancelled = false;
    appkitModulePromise?.then((m) => {
      if (cancelled) return;
      const real = m.getWagmiConfig();
      if (real && real !== ssrWagmiConfig) {
        const { onMount } = hydrate(real, { reconnectOnMount: true });
        Promise.resolve(onMount()).catch(() => {});
        setConfig(real);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
