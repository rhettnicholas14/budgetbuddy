import type { Category } from "@/lib/domain/types";

export const categories: Category[] = [
  { id: "cat-bills", slug: "bills", label: "Bills", group: "ignore", budgeted: false, accent: "#8fa3ad" },
  { id: "cat-fixed", slug: "fixed_cc", label: "Fixed CC", group: "spend", budgeted: true, accent: "#244855" },
  { id: "cat-groceries", slug: "groceries", label: "Groceries", group: "spend", budgeted: true, accent: "#4e7f52" },
  { id: "cat-essential", slug: "essential_variable", label: "Essential Variable", group: "spend", budgeted: true, accent: "#6d8d9e" },
  { id: "cat-lifestyle", slug: "lifestyle", label: "Lifestyle", group: "spend", budgeted: true, accent: "#ef7d57" },
  { id: "cat-oneoff", slug: "one_off", label: "One-Off", group: "spend", budgeted: true, accent: "#cc5b5b" },
  { id: "cat-mortgage", slug: "mortgage", label: "Mortgage", group: "ignore", budgeted: false, accent: "#5f6b8a" },
  { id: "cat-mortgage-extra", slug: "mortgage_extra", label: "Mortgage Extra", group: "ignore", budgeted: false, accent: "#7887a5" },
  { id: "cat-childcare", slug: "childcare", label: "Childcare", group: "ignore", budgeted: false, accent: "#6f6fb0" },
  { id: "cat-childcare-rebate", slug: "childcare_rebate", label: "Childcare Rebate", group: "offset", budgeted: false, accent: "#99b898" },
  { id: "cat-transfer", slug: "transfer", label: "Transfer", group: "ignore", budgeted: false, accent: "#9da7b1" },
  { id: "cat-kids", slug: "kids_savings", label: "Kids Savings", group: "ignore", budgeted: false, accent: "#7a9e9f" },
  { id: "cat-rebate", slug: "rebate", label: "Rebate", group: "offset", budgeted: false, accent: "#a3bf7a" },
  { id: "cat-income", slug: "income", label: "Income", group: "offset", budgeted: false, accent: "#58a56f" },
  { id: "cat-review", slug: "review", label: "Review - Split", group: "ignore", budgeted: false, reviewByDefault: true, accent: "#d7a44d" },
  { id: "cat-uncategorized", slug: "uncategorized", label: "Review", group: "ignore", budgeted: false, reviewByDefault: true, accent: "#b56f6f" },
];

export const mainSpendBuckets = [
  "fixed_cc",
  "groceries",
  "essential_variable",
  "lifestyle",
  "one_off",
] as const;

export const editableMappingBuckets = categories.map((category) => ({
  label: category.label,
  value: category.slug,
}));

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}
