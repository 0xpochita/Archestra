import Image from "next/image";
import { BLOCK_CATALOG } from "@/constants/blocks";
import type { BlockKind } from "@/types/block";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

interface BlockGlyphProps {
  kind: BlockKind;
  className?: string;
}

export function BlockGlyph({ kind, className }: BlockGlyphProps) {
  const definition = BLOCK_CATALOG[kind];

  if (definition.logo) {
    return <Logo name={definition.logo} className={className} />;
  }

  const [primaryImage] = definition.logoImages ?? [];
  if (primaryImage) {
    return (
      <Image
        src={primaryImage.src}
        alt={primaryImage.alt}
        width={24}
        height={24}
        className={`${className ?? ""} rounded-full object-cover`}
      />
    );
  }

  return <Icon name={definition.icon} className={className} />;
}
