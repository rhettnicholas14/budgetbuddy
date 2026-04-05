"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteMerchantRule,
  reapplyMerchantRulesToTransactions,
  saveMerchantRule,
  saveTransactionCategory,
  updateMerchantRule,
} from "@/lib/app-data";
import type { CategoryKind } from "@/lib/domain/types";

function withStatus(path: string, status: string) {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("status", status);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}

export async function updateTransactionCategoryAction(formData: FormData) {
  const transactionId = String(formData.get("transactionId") ?? "");
  const category = String(formData.get("category") ?? "uncategorized") as CategoryKind;
  const notes = String(formData.get("notes") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");

  await saveTransactionCategory(transactionId, category, notes);
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/review");
  revalidatePath("/trends");

  if (returnTo.startsWith("/")) {
    redirect(withStatus(returnTo, "saved"));
  }
}

export async function addMerchantRuleAction(formData: FormData) {
  const merchantPattern = String(formData.get("merchantPattern") ?? "");
  const category = String(formData.get("category") ?? "review") as CategoryKind;
  const splitMerchant = formData.get("splitMerchant") === "on";
  const returnTo = String(formData.get("returnTo") ?? "");

  if (!merchantPattern) {
    return;
  }

  await saveMerchantRule(merchantPattern, category, splitMerchant);
  revalidatePath("/settings");
  revalidatePath("/review");

  if (returnTo.startsWith("/")) {
    redirect(withStatus(returnTo, "rule-saved"));
  }
}

export async function updateMerchantRuleAction(formData: FormData) {
  const ruleId = String(formData.get("ruleId") ?? "");
  const merchantPattern = String(formData.get("merchantPattern") ?? "");
  const category = String(formData.get("category") ?? "review") as CategoryKind;
  const splitMerchant = formData.get("splitMerchant") === "on";
  const active = formData.get("active") === "on";
  const returnTo = String(formData.get("returnTo") ?? "");

  await updateMerchantRule(ruleId, merchantPattern, category, splitMerchant, active);
  revalidatePath("/settings");
  revalidatePath("/review");
  revalidatePath("/transactions");

  if (returnTo.startsWith("/")) {
    redirect(withStatus(returnTo, "rule-updated"));
  }
}

export async function deleteMerchantRuleAction(formData: FormData) {
  const ruleId = String(formData.get("ruleId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");

  await deleteMerchantRule(ruleId);
  revalidatePath("/settings");
  revalidatePath("/review");
  revalidatePath("/transactions");

  if (returnTo.startsWith("/")) {
    redirect(withStatus(returnTo, "rule-deleted"));
  }
}

export async function reapplyMerchantRulesAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");

  await reapplyMerchantRulesToTransactions();
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/review");
  revalidatePath("/trends");
  revalidatePath("/settings");

  if (returnTo.startsWith("/")) {
    redirect(withStatus(returnTo, "rules-reapplied"));
  }
}

export async function applyAiSuggestionAction(formData: FormData) {
  const transactionId = String(formData.get("transactionId") ?? "");
  const category = String(formData.get("category") ?? "uncategorized") as CategoryKind;
  const reason = String(formData.get("reason") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");

  await saveTransactionCategory(transactionId, category, reason);
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/review");
  revalidatePath("/trends");

  if (returnTo.startsWith("/")) {
    redirect(withStatus(returnTo, "saved"));
  }
}
