import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Phone, Mail, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RepairStatus {
  ticketNumber: string;
  status: "pending" | "in-progress" | "completed";
  productName: string;
  productModel: string;
  issue: string;
  estimatedCompletion: string;
  timeline: TimelineItem[];
}

interface TimelineItem {
  step: string;
  description: string;
  completed: boolean;
  date?: string;
}

// Mock data for demonstration
const mockRepairData: Record<string, RepairStatus> = {
  "TKT-001234": {
    ticketNumber: "TKT-001234",
    status: "in-progress",
    productName: "MacBook Pro",
    productModel: "14-inch, 2023",
    issue: "Screen replacement",
    estimatedCompletion: "January 30, 2026",
    timeline: [
      {
        step: "Received",
        description: "Device received at service center",
        completed: true,
        date: "Jan 25, 2026",
      },
      {
        step: "Diagnosed",
        description: "Issue diagnosed and parts ordered",
        completed: true,
        date: "Jan 26, 2026",
      },
      {
        step: "In Repair",
        description: "Repair in progress",
        completed: false,
      },
      {
        step: "Quality Check",
        description: "Final testing and quality assurance",
        completed: false,
      },
      {
        step: "Ready",
        description: "Ready for pickup",
        completed: false,
      },
    ],
  },
  "TKT-005678": {
    ticketNumber: "TKT-005678",
    status: "completed",
    productName: "iPhone 15 Pro",
    productModel: "256GB",
    issue: "Battery replacement",
    estimatedCompletion: "January 20, 2026",
    timeline: [
      {
        step: "Received",
        description: "Device received at service center",
        completed: true,
        date: "Jan 18, 2026",
      },
      {
        step: "Diagnosed",
        description: "Issue diagnosed and parts ordered",
        completed: true,
        date: "Jan 18, 2026",
      },
      {
        step: "In Repair",
        description: "Repair in progress",
        completed: true,
        date: "Jan 19, 2026",
      },
      {
        step: "Quality Check",
        description: "Final testing and quality assurance",
        completed: true,
        date: "Jan 20, 2026",
      },
      {
        step: "Ready",
        description: "Ready for pickup",
        completed: true,
        date: "Jan 20, 2026",
      },
    ],
  },
};

const statusColors = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  "in-progress": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
};

const statusLabels = {
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
};

export function CustomerPortal() {
  const [ticketNumber, setTicketNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<RepairStatus | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!ticketNumber.trim()) return;

    setIsSearching(true);
    setNotFound(false);
    setSearchResult(null);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = mockRepairData[ticketNumber.toUpperCase()];
    if (result) {
      setSearchResult(result);
    } else {
      setNotFound(true);
    }

    setIsSearching(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Customer Portal</h1>
        <p className="text-muted-foreground mt-2">
          Check the repair status of your product by entering your ticket number.
        </p>
      </div>

      {/* Search Section */}
      <Card className="mb-8 max-w-xl">
        <CardHeader>
          <CardTitle>Track Your Repair</CardTitle>
          <CardDescription>
            Enter your ticket number (e.g., TKT-001234) to check the status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter ticket number..."
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Try: TKT-001234 or TKT-005678
          </p>
        </CardContent>
      </Card>

      {/* Results Section */}
      <AnimatePresence mode="wait">
        {searchResult && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="max-w-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      {searchResult.ticketNumber}
                      <Badge
                        variant="outline"
                        className={statusColors[searchResult.status]}
                      >
                        {statusLabels[searchResult.status]}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {searchResult.productName} - {searchResult.productModel}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Product Info */}
                <div className="rounded-lg border p-4">
                  <h3 className="font-medium mb-2">Repair Details</h3>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issue:</span>
                      <span>{searchResult.issue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Estimated Completion:
                      </span>
                      <span>{searchResult.estimatedCompletion}</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="font-medium mb-4">Repair Progress</h3>
                  <div className="space-y-4">
                    {searchResult.timeline.map((item, index) => (
                      <motion.div
                        key={item.step}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex gap-4"
                      >
                        <div className="flex flex-col items-center">
                          {item.completed ? (
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                          ) : (
                            <Circle className="text-muted-foreground h-6 w-6" />
                          )}
                          {index < searchResult.timeline.length - 1 && (
                            <div
                              className={`mt-1 h-full w-0.5 ${
                                item.completed
                                  ? "bg-green-500"
                                  : "bg-muted"
                              }`}
                            />
                          )}
                        </div>
                        <div className="pb-4">
                          <p
                            className={`font-medium ${
                              item.completed
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {item.step}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {item.description}
                          </p>
                          {item.date && (
                            <p className="text-muted-foreground mt-1 text-xs">
                              {item.date}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {notFound && (
          <motion.div
            key="not-found"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="max-w-xl">
              <CardContent className="py-8 text-center">
                <div className="text-muted-foreground mb-4">
                  <Search className="mx-auto h-12 w-12 opacity-50" />
                </div>
                <h3 className="text-lg font-medium mb-2">Ticket Not Found</h3>
                <p className="text-muted-foreground mb-4">
                  We couldn't find a repair ticket with that number. Please check
                  the ticket number and try again.
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" asChild>
                    <a href="tel:+15551234567">
                      <Phone className="mr-2 h-4 w-4" />
                      Call Support
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="mailto:support@serviceplus.com">
                      <Mail className="mr-2 h-4 w-4" />
                      Email Support
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
