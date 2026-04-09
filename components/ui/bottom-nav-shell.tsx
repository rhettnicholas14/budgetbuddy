"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/bottom-nav";

export function BottomNavShell() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[104px]" aria-hidden="true" />;
  }

  return (
    <>
      <div className="h-[104px]" aria-hidden="true" />
      <BottomNav />
    </>
  );
}
