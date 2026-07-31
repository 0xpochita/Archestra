import { explorerAddressUrl } from "@/config/chain";
import { truncateAddress } from "@/lib/format";
import { Icon } from "./Icon";

interface AddressLinkProps {
  address: string;
  label?: string;
  className?: string;
}

export function AddressLink({ address, label, className }: AddressLinkProps) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      title={address}
      className={`inline-flex items-center gap-1.5 font-mono text-xs text-ink-muted transition-colors hover:text-ink ${className ?? ""}`}
    >
      {label ?? truncateAddress(address)}
      <Icon name="external" className="size-3" />
    </a>
  );
}
