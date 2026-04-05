import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Household Spend Tracker",
    short_name: "Spend Tracker",
    description: "Shared household finance tracking for two people.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f6f1eb",
    theme_color: "#132437",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
