import type { Metadata } from "next";
import { Toaster } from "sonner";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

import "./globals.css";

export const metadata: Metadata = {
  title: "Service+ — Track Your Repair",
  description:
    "Check the repair status of your device, find genuine spare parts, and get help from Service+.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <Header />
        <div className="flex flex-1 flex-col lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <Footer />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
