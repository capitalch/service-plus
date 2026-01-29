import { motion } from "framer-motion";
import {
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stats = [
  {
    title: "Total Tickets",
    value: "1,234",
    description: "All time tickets",
    icon: Ticket,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Pending",
    value: "56",
    description: "Awaiting assignment",
    icon: Clock,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    title: "In Progress",
    value: "23",
    description: "Currently being worked on",
    icon: AlertCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    title: "Completed",
    value: "1,155",
    description: "Successfully resolved",
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
};

export function Dashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to Service Plus. Here's an overview of your service operations.
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.title} variants={itemVariants}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <div className={`rounded-full p-2 ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <CardDescription>{stat.description}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="mt-8"
      >
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest updates from your service operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-center py-8">
              Activity feed will be displayed here
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
