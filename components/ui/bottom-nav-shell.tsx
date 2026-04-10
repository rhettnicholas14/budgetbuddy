"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/bottom-nav";

export function BottomNavShell() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div data-mobile-nav-spacer="true" className="h-[104px] sm:hidden" aria-hidden="true" />;
  }

  return (
    <>
      <div data-mobile-nav-spacer="true" className="h-[104px] sm:hidden" aria-hidden="true" />
      <BottomNav />
    </>
  );
}
