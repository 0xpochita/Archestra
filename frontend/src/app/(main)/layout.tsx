import type { ReactNode } from "react";
import { ChainProvider } from "@/providers/ChainProvider";

export default function MainLayout({ children }: { children: ReactNode }) {
  return <ChainProvider>{children}</ChainProvider>;
}
