"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isDev = process.env.NODE_ENV !== "production";
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isDev || isLocalhost) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => null);
        });
      });

      caches.keys().then((keys) => {
        keys.forEach((key) => {
          caches.delete(key).catch(() => null);
        });
      });

      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => null);
  }, []);

  return null;
}
