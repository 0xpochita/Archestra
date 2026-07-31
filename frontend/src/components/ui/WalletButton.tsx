"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { ARC_CHAIN_NAME } from "@/config/chain";
import { ARC_LOGO_SRC } from "@/constants/assets";

const BUTTON_CLASS =
  "flex items-center gap-2 border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-hover";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        if (!mounted) {
          return (
            <span
              aria-hidden
              className="pointer-events-none select-none opacity-0"
            >
              <span className={BUTTON_CLASS}>
                <Icon name="wallet" className="size-4" />
                Connect wallet
              </span>
            </span>
          );
        }

        if (!account || !chain) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={BUTTON_CLASS}
            >
              <Icon name="wallet" className="size-4" />
              Connect wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={`${BUTTON_CLASS} border-ink`}
            >
              <Icon name="bolt" className="size-4" />
              Switch to {ARC_CHAIN_NAME}
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openChainModal}
              className={BUTTON_CLASS}
            >
              <Image
                src={ARC_LOGO_SRC}
                alt=""
                width={16}
                height={16}
                className="size-4"
              />
              {chain.name ?? ARC_CHAIN_NAME}
            </button>
            <button
              type="button"
              onClick={openAccountModal}
              title="Account details"
              className={`${BUTTON_CLASS} font-mono`}
            >
              <Icon name="wallet" className="size-4" />
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
