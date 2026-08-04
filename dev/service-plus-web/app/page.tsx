import { FeatureCards } from "@/components/home/feature-cards";
import { Hero } from "@/components/home/hero";
import { JobStatusForm } from "@/components/home/job-status-form";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureCards />
      <JobStatusForm />
    </>
  );
}
