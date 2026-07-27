import { HeroFlow } from "./components/HeroFlow";
import { HeroIntro } from "./components/HeroIntro";
import { HeroWordStack } from "./components/HeroWordStack";
import { LandingFooter } from "./components/LandingFooter";
import { LandingNav } from "./components/LandingNav";

export function LandingPage() {
  return (
    <div className="min-h-svh bg-shell text-ink">
      <LandingNav />
      <main className="px-6 pb-20 lg:px-12">
        <div className="workflow-grid border border-line py-10">
          <HeroFlow />
        </div>
        <div className="grid items-start gap-10 pt-8 pb-16 lg:grid-cols-[1.4fr_1fr] lg:pt-10 lg:pb-20">
          <HeroIntro />
          <HeroWordStack />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
