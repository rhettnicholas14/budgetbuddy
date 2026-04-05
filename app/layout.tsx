import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { PwaRegister } from "@/components/providers/pwa-register";
import "./globals.css";

const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Household Spend Tracker",
  description: "A mobile-first household finance dashboard for two people.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Spend Tracker",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable} h-full bg-[--color-app-bg] antialiased`}
    >
      <body className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(246,241,235,0.98)_45%,_rgba(239,232,222,1)_100%)] text-slate-950">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
