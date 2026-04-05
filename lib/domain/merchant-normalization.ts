const replacements: Array<[RegExp, string]> = [
  [/woolworths.*/i, "Woolworths"],
  [/woolies.*/i, "Woolworths"],
  [/coles.*/i, "Coles"],
  [/aldi.*/i, "ALDI"],
  [/bakers delight.*/i, "Bakers Delight"],
  [/chemist warehouse.*/i, "Chemist Warehouse"],
  [/7-?eleven.*/i, "7-Eleven"],
  [/dan murphy.*/i, "Dan Murphy's"],
  [/uber eats.*/i, "Uber Eats"],
  [/uber trip.*/i, "Uber"],
  [/amazon.*/i, "Amazon"],
  [/apple\.com\/bill.*/i, "Apple"],
  [/apple services.*/i, "Apple"],
  [/medicare.*/i, "Medicare"],
  [/ccs.*/i, "CCS"],
  [/salary.*/i, "Salary"],
];

export function normalizeMerchant(input: string) {
  const base = input
    .replace(/\d+/g, " ")
    .replace(/[^\w\s+']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) {
    return "Unknown Merchant";
  }

  for (const [matcher, replacement] of replacements) {
    if (matcher.test(base)) {
      return replacement;
    }
  }

  return base
    .split(" ")
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
