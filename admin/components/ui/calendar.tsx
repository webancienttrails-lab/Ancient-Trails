"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CalendarProps = {
  className?: string;
  onClear?: () => void;
  onSelect?: (date: Date) => void;
  selected?: Date | null;
  showMonthYearDropdowns?: boolean;
  yearRange?: {
    from: number;
    to: number;
  };
};

const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthOptions = Array.from({ length: 12 }, (_item, monthIndex) => ({
  label: new Date(2026, monthIndex, 1).toLocaleDateString("en-US", {
    month: "long",
  }),
  value: String(monthIndex),
}));

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function createMonthDays(month: Date): Date[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstCalendarDay = new Date(firstDay);

  firstCalendarDay.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_item, index) => {
    const date = new Date(firstCalendarDay);
    date.setDate(firstCalendarDay.getDate() + index);
    return date;
  });
}

function formatMonthLabel(month: Date): string {
  return month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function Calendar({
  className,
  onClear,
  onSelect,
  selected,
  showMonthYearDropdowns = false,
  yearRange,
}: CalendarProps) {
  const today = startOfDay(new Date());
  const currentYear = today.getFullYear();
  const [visibleMonth, setVisibleMonth] = React.useState(
    selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : today
  );
  const yearOptions = React.useMemo(() => {
    const fromYear = yearRange?.from ?? currentYear - 120;
    const toYear = yearRange?.to ?? currentYear + 10;
    const startYear = Math.min(fromYear, toYear);
    const endYear = Math.max(fromYear, toYear);

    return Array.from({ length: endYear - startYear + 1 }, (_item, index) =>
      String(startYear + index)
    );
  }, [currentYear, yearRange]);

  const monthDays = createMonthDays(visibleMonth);

  function moveMonth(offset: number) {
    setVisibleMonth(
      (currentMonth) =>
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1)
    );
  }

  function selectToday() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelect?.(today);
  }

  return (
    <div className={cn("w-[292px] rounded-sm bg-popover text-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          className="grid size-8 place-items-center rounded-sm text-foreground/70 transition-colors hover:bg-muted hover:text-primary"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        {showMonthYearDropdowns ? (
          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_86px] gap-2">
            <Select
              value={String(visibleMonth.getMonth())}
              onValueChange={(value) =>
                setVisibleMonth(
                  (currentMonth) =>
                    new Date(
                      currentMonth.getFullYear(),
                      Number(value),
                      1
                    )
                )
              }
            >
              <SelectTrigger className="h-8 min-h-8 rounded-sm px-2 py-1 text-xs">
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-none">
                  {monthOptions[visibleMonth.getMonth()]?.label}
                </span>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(visibleMonth.getFullYear())}
              onValueChange={(value) =>
                setVisibleMonth(
                  (currentMonth) =>
                    new Date(
                      Number(value),
                      currentMonth.getMonth(),
                      1
                    )
                )
              }
            >
              <SelectTrigger className="h-8 min-h-8 rounded-sm px-2 py-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="font-sans text-sm font-bold text-foreground">
            {formatMonthLabel(visibleMonth)}
          </div>
        )}
        <button
          type="button"
          onClick={() => moveMonth(1)}
          className="grid size-8 place-items-center rounded-sm text-foreground/70 transition-colors hover:bg-muted hover:text-primary"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {weekDays.map((day) => (
          <div
            key={day}
            className="grid h-8 place-items-center text-[11px] font-bold uppercase text-foreground/55"
          >
            {day}
          </div>
        ))}

        {monthDays.map((date) => {
          const isOutsideMonth = date.getMonth() !== visibleMonth.getMonth();
          const isSelected = selected ? isSameDay(date, selected) : false;
          const isToday = isSameDay(date, today);

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelect?.(date)}
              className={cn(
                "grid h-8 place-items-center rounded-sm text-xs font-semibold transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/20",
                isOutsideMonth && "text-foreground/35",
                isToday && !isSelected && "border border-primary/35 text-primary",
                isSelected && "bg-primary text-white hover:bg-primary hover:text-white"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={onClear}
          className="h-8 rounded-sm px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={selectToday}
          className="h-8 rounded-sm px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Today
        </button>
      </div>
    </div>
  );
}

export { Calendar };
