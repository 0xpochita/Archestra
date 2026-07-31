"use client";

import Image from "next/image";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { Icon } from "@/components/ui/Icon";
import { ARC_CHAIN_ID, ARC_CHAIN_NAME } from "@/config/chain";
import { ARC_LOGO_SRC } from "@/constants/assets";
import { useIsMounted } from "@/hooks/useIsMounted";
import { truncateAddress } from "@/lib/format";

const BUTTON_CLASS =
  "flex items-center gap-2 border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-60";

export function WalletButton() {
  const isMounted = useIsMounted();
  const { address, chainId, isConnected, isConnecting } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();

  const injectedConnector = isMounted ? connectors.at(0) : undefined;
  const isWrongNetwork = isMounted && isConnected && chainId !== ARC_CHAIN_ID;

  if (!isMounted || !isConnected) {
    return (
      <button
        type="button"
        disabled={Boolean(
          !injectedConnector || isConnecting || connect.isPending,
        )}
        onClick={() => {
          if (injectedConnector) {
            connect.mutate({ connector: injectedConnector });
          }
        }}
        title={
          injectedConnector
            ? `Connect to ${ARC_CHAIN_NAME}`
            : "No browser wallet detected"
        }
        className={BUTTON_CLASS}
      >
        <Icon
          name={connect.isPending ? "loader" : "wallet"}
          className={`size-4 ${connect.isPending ? "animate-spin" : ""}`}
        />
        {connect.isPending ? "Connecting" : "Connect wallet"}
      </button>
    );
  }

  if (isWrongNetwork) {
    return (
      <button
        type="button"
        disabled={switchChain.isPending}
        onClick={() => switchChain.mutate({ chainId: ARC_CHAIN_ID })}
        className={`${BUTTON_CLASS} border-ink`}
      >
        <Icon
          name={switchChain.isPending ? "loader" : "bolt"}
          className={`size-4 ${switchChain.isPending ? "animate-spin" : ""}`}
        />
        Switch to {ARC_CHAIN_NAME}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-2 border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted">
        <Image
          src={ARC_LOGO_SRC}
          alt=""
          width={16}
          height={16}
          className="size-4"
        />
        {ARC_CHAIN_NAME}
      </span>
      <button
        type="button"
        onClick={() => disconnect.mutate()}
        title={`${address} (click to disconnect)`}
        className={`${BUTTON_CLASS} font-mono`}
      >
        <Icon name="wallet" className="size-4" />
        {address ? truncateAddress(address) : ""}
      </button>
    </div>
  );
}
