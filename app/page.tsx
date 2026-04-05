import { redirect } from "next/navigation";
import { appEnv } from "@/lib/env";

export default function Home() {
  redirect(appEnv.mockMode ? "/dashboard" : "/auth/login");
}
