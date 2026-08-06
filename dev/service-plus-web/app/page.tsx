import { FeatureCards } from "@/components/home/feature-cards";
import { Hero } from "@/components/home/hero";
import { RepairStatusCard } from "@/components/home/repair-status-card";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 -z-10 flex justify-center"
        >
          <div className="h-80 w-[36rem] rounded-full bg-primary/20 blur-3xl" />
        </div>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 py-10 lg:py-16">
          <Hero />
          <RepairStatusCard />
        </div>
      </section>
      <FeatureCards />
    </>
  );
}
