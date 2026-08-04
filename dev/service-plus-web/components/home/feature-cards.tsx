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
    <section className="mx-auto max-w-5xl px-4 py-12">
      <div className="grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <feature.icon className="size-6 text-primary" />
              <CardTitle className="mt-3 flex items-center gap-2">
                {feature.title}
                <Badge variant={feature.status === "Live" ? "default" : "secondary"}>
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
