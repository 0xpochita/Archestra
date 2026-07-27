import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { BLOCK_CATALOG } from "../constants";
import type { BlockKind } from "../types";

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
