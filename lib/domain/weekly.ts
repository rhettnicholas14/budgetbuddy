import {
  addDays,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  max,
  min,
  setDate,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { getCycleWindow } from "@/lib/domain/cycle";
import type { Transaction, WeeklyMode, WeeklyStatus, WeeklyTrackerPoint } from "@/lib/domain/types";

export const WEEKLY_TARGET = 850;

export function getWeekStatus(controlSpend: number): WeeklyStatus {
  if (controlSpend < 750) {
    return { label: "On Track", tone: "green" };
  }

  if (controlSpend <= WEEKLY_TARGET) {
    return { label: "Watch It", tone: "amber" };
  }

  return { label: "Over Pace", tone: "red" };
}

export function getWeekRange(date = new Date(), mode: WeeklyMode = "calendar", cycleStartDay = 22) {
  const current = startOfDay(date);

  if (mode === "calendar") {
    const start = startOfWeek(current, { weekStartsOn: 1 });
    const end = endOfWeek(current, { weekStartsOn: 1 });

    return { start, end };
  }

  const cycle = getCycleWindow(current, cycleStartDay);
  const cycleStart = startOfDay(cycle.start);
  const cycleEnd = startOfDay(cycle.end);
  const daysIntoCycle = Math.floor((current.getTime() - cycleStart.getTime()) / 86_400_000);
  const segmentIndex = Math.floor(daysIntoCycle / 7);
  const start = addDays(cycleStart, segmentIndex * 7);
  const end = min([cycleEnd, addDays(start, 6)]);

  return { start, end };
}

export function getWeekLabel(date = new Date(), mode: WeeklyMode = "calendar", cycleStartDay = 22) {
  const { start, end } = getWeekRange(date, mode, cycleStartDay);
  return `${format(start, "d MMM")} - ${format(end, "d MMM")}`;
}

export function getWeeklyTotals(transactions: Transaction[], weekStart: Date, weekEnd: Date) {
  const inWeek = transactions.filter((transaction) => {
    const txDate = startOfDay(new Date(transaction.date));
    return !isBefore(txDate, weekStart) && !isAfter(txDate, weekEnd);
  });

  const categoryTotal = (category: Transaction["finalCategory"]) =>
    inWeek
      .filter((transaction) => transaction.finalCategory === category)
      .reduce((sum, transaction) => sum + debitAmount(transaction), 0);

  const groceries = categoryTotal("groceries");
  const lifestyle = categoryTotal("lifestyle");
  const essentialVariable = categoryTotal("essential_variable");
  const fixedCC = categoryTotal("fixed_cc");
  const totalSpend = inWeek
    .filter((transaction) => !IGNORED_WEEKLY_TOTAL_CATEGORIES.has(transaction.finalCategory))
    .reduce((sum, transaction) => sum + debitAmount(transaction), 0);
  const controlSpend = groceries + lifestyle;

  return {
    groceries,
    lifestyle,
    essentialVariable,
    fixedCC,
    totalSpend,
    controlSpend,
    transactions: inWeek
      .filter((transaction) => debitAmount(transaction) > 0)
      .sort((left, right) => right.date.localeCompare(left.date)),
  };
}

export function getWeeklyHistory(
  transactions: Transaction[],
  mode: WeeklyMode = "calendar",
  cycleStartDay = 22,
  now = new Date(),
  count = 8,
): WeeklyTrackerPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const referenceDate = subWeeks(now, count - index - 1);
    const { start, end } = getWeekRange(referenceDate, mode, cycleStartDay);
    const totals = getWeeklyTotals(transactions, start, end);

    return {
      label: `${format(start, "d MMM")}`,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      groceries: totals.groceries,
      lifestyle: totals.lifestyle,
      essentialVariable: totals.essentialVariable,
      fixedCC: totals.fixedCC,
      totalSpend: totals.totalSpend,
      controlSpend: totals.controlSpend,
    };
  });
}

const IGNORED_WEEKLY_TOTAL_CATEGORIES = new Set([
  "bills",
  "transfer",
  "rebate",
  "income",
  "mortgage",
  "mortgage_extra",
  "childcare_rebate",
]);

function debitAmount(transaction: Transaction) {
  return transaction.direction === "debit" ? Math.abs(transaction.amount) : 0;
}
