import { Bot, PackageSearch, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Wrench,
    title: "Job status query",
    description: "Enter your job number and mobile to see exactly where your repair stands.",
    status: "Live",
  },
  {
    icon: Bot,
    title: "AI repair help",
    description: "Describe a fault and get an instant estimate before you visit a center.",
    status: "Coming soon",
  },
  {
    icon: PackageSearch,
    title: "Genuine spare parts",
    description: "Check availability and prices for genuine parts, direct from the source.",
    status: "Coming soon",
  },
] as const;

export function FeatureCards() {
  return (
    <section className="mx-auto max-w-5xl border-t border-border/60 px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Everything in one place
        </h2>
        <p className="mt-2 text-muted-foreground">
          Beyond tracking your repair, here&apos;s what else Service Plus is building for you.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
          >
            <CardHeader>
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="size-5" />
              </span>
              <CardTitle className="mt-3 flex items-center gap-2">
                {feature.title}
                <Badge variant={feature.status === "Live" ? "success" : "outline"}>
                  {feature.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
