import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { SuperAdminLayout } from "./super-admin-layout";

type DummyPagePropsType = {
  description: string;
  icon: React.ElementType;
  title: string;
};

export const DummyPage = ({ description, icon: Icon, title }: DummyPagePropsType) => {
  return (
    <SuperAdminLayout>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-1 items-center justify-center py-20"
        initial={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <Card className="w-full max-w-md border shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 px-8 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <Icon className="h-8 w-8 text-slate-400" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500">{description}</p>
            </div>
            <Badge
              className="border-slate-200 bg-slate-100 text-slate-500"
              variant="outline"
            >
              Coming Soon
            </Badge>
          </CardContent>
        </Card>
      </motion.div>
    </SuperAdminLayout>
  );
};
