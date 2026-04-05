import { addDays, differenceInCalendarDays, format, isAfter, setDate, startOfDay, subMonths } from "date-fns";
import type { CycleWindow } from "@/lib/domain/types";

export function getCycleWindow(date = new Date(), startDay = 22): CycleWindow {
  const current = startOfDay(date);
  let cycleStart = setDate(current, startDay);

  if (isAfter(cycleStart, current)) {
    cycleStart = setDate(subMonths(current, 1), startDay);
  }

  const cycleEnd = addDays(setDate(addDays(cycleStart, 32), startDay), -1);
  const totalDays = differenceInCalendarDays(cycleEnd, cycleStart) + 1;
  const daysElapsed = Math.min(differenceInCalendarDays(current, cycleStart) + 1, totalDays);

  return {
    label: `${format(cycleStart, "d MMM")} - ${format(cycleEnd, "d MMM")}`,
    start: cycleStart,
    end: cycleEnd,
    totalDays,
    daysElapsed,
    progress: daysElapsed / totalDays,
  };
}

export function getCycleLabelFromDate(date: string, startDay = 22) {
  return getCycleWindow(new Date(date), startDay).label;
}
