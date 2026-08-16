import { Hero } from "@/components/home/hero";
import { RepairStatusCard } from "@/components/home/repair-status-card";

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* Top padding replaces the spacing the removed Services section used to provide. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 lg:px-6 lg:pt-20 lg:pb-28">
        <RepairStatusCard />
      </section>
    </>
  );
}
