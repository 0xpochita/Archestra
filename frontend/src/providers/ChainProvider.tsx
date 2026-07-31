"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { createConfig, fallback, http, injected, WagmiProvider } from "wagmi";
import { ARC_CHAIN_ID, ARC_RPC_URLS, arcChain } from "@/config/chain";

const wagmiConfig = createConfig({
  chains: [arcChain],
  connectors: [injected()],
  transports: {
    [ARC_CHAIN_ID]: fallback(
      ARC_RPC_URLS.map((url) => http(url, { batch: true })),
      { rank: false, retryCount: 2 },
    ),
  },
  ssr: true,
});

const STALE_TIME_MS = 15_000;

const monochromeTheme = lightTheme({
  accentColor: "#0a0a0a",
  accentColorForeground: "#ffffff",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});

export function ChainProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: STALE_TIME_MS, retry: 1 } },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={monochromeTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
