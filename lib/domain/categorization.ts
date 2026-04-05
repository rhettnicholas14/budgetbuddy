import { categories } from "@/lib/domain/categories";
import { normalizeMerchant } from "@/lib/domain/merchant-normalization";
import type { CategoryKind, MerchantRule, Transaction } from "@/lib/domain/types";

type ResolutionInput = Pick<
  Transaction,
  "merchantRaw" | "descriptionRaw" | "overrideCategory" | "amount" | "direction"
> & {
  merchantNormalized?: string;
  rules: MerchantRule[];
};

export function resolveTransactionCategory({
  merchantRaw,
  descriptionRaw,
  overrideCategory,
  amount,
  direction,
  merchantNormalized,
  rules,
}: ResolutionInput): {
  merchantNormalized: string;
  autoCategory: CategoryKind | null;
  finalCategory: CategoryKind;
  needsReview: boolean;
} {
  const normalized = merchantNormalized ?? normalizeMerchant(merchantRaw || descriptionRaw);

  if (overrideCategory) {
    return {
      merchantNormalized: normalized,
      autoCategory: null,
      finalCategory: overrideCategory,
      needsReview: false,
    };
  }

  const sortedRules = rules
    .filter((rule) => rule.active)
    .sort((left, right) => left.priority - right.priority);
  const exactMatch = sortedRules.find(
    (rule) => rule.matchType === "exact" && rule.normalizedMerchant.toLowerCase() === normalized.toLowerCase(),
  );

  if (exactMatch) {
    return {
      merchantNormalized: normalized,
      autoCategory: exactMatch.category,
      finalCategory: exactMatch.category,
      needsReview: exactMatch.category === "review",
    };
  }

  const containsMatch = sortedRules.find((rule) => {
    if (rule.matchType !== "contains") {
      return false;
    }

    const haystack = `${merchantRaw} ${descriptionRaw} ${normalized}`.toLowerCase();
    return haystack.includes(rule.merchantPattern.toLowerCase());
  });

  if (containsMatch) {
    return {
      merchantNormalized: normalized,
      autoCategory: containsMatch.category,
      finalCategory: containsMatch.category,
      needsReview: containsMatch.category === "review",
    };
  }

  if (direction === "credit") {
    if (/salary/i.test(descriptionRaw) || /salary/i.test(merchantRaw)) {
      return reviewlessResult(normalized, "income");
    }
    if (/medicare/i.test(descriptionRaw) || /ccs/i.test(descriptionRaw)) {
      return reviewlessResult(normalized, /ccs/i.test(descriptionRaw) ? "childcare_rebate" : "rebate");
    }
  }

  if (direction === "debit" && amount > 600) {
    return {
      merchantNormalized: normalized,
      autoCategory: "one_off",
      finalCategory: "one_off",
      needsReview: true,
    };
  }

  return {
    merchantNormalized: normalized,
    autoCategory: null,
    finalCategory: "uncategorized",
    needsReview: true,
  };
}

function reviewlessResult(merchantNormalized: string, category: CategoryKind) {
  return {
    merchantNormalized,
    autoCategory: category,
    finalCategory: category,
    needsReview: false,
  };
}

export function isSpendCategory(category: CategoryKind) {
  return categories.some((entry) => entry.slug === category && entry.group === "spend");
}
