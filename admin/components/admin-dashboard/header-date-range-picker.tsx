"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateRange = {
  from: Date | null;
  to: Date | null;
};

const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getCurrentMonthRange(): { from: Date; to: Date } {
  const today = new Date();

  return {
    from: new Date(today.getFullYear(), today.getMonth(), 1),
    to: new Date(today.getFullYear(), today.getMonth() + 1, 0),
  };
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

function isSameDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function isWithinRange(date: Date, range: DateRange): boolean {
  if (!range.from || !range.to) {
    return false;
  }

  const time = startOfDay(date).getTime();
  return time > range.from.getTime() && time < range.to.getTime();
}

function formatMonthLabel(month: Date): string {
  return month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatRangeDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function formatRangeLabel(range: DateRange): string {
  if (range.from && range.to) {
    return `${formatRangeDate(range.from)} - ${formatRangeDate(range.to)}`;
  }

  if (range.from) {
    return `${formatRangeDate(range.from)} - Select end`;
  }

  return "Select date range";
}

function HeaderDateRangePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [range, setRange] = useState<DateRange>(() => getCurrentMonthRange());
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const months = useMemo(
    () => [visibleMonth, addMonths(visibleMonth, 1)],
    [visibleMonth]
  );

  function moveMonth(amount: number) {
    setVisibleMonth((currentMonth) => addMonths(currentMonth, amount));
  }

  function selectDate(date: Date) {
    const selectedDate = startOfDay(date);

    if (!range.from || range.to) {
      setRange({ from: selectedDate, to: null });
      return;
    }

    if (selectedDate.getTime() < range.from.getTime()) {
      setRange({ from: selectedDate, to: range.from });
      setIsOpen(false);
      return;
    }

    setRange({ from: range.from, to: selectedDate });
    setIsOpen(false);
  }

  function resetRange() {
    const currentMonthRange = getCurrentMonthRange();

    setRange(currentMonthRange);
    setVisibleMonth(startOfMonth(currentMonthRange.from));
  }

  function selectToday() {
    const today = startOfDay(new Date());
    setRange({ from: today, to: null });
    setVisibleMonth(startOfMonth(today));
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        type="button"
        className="flex h-10 items-center justify-center gap-1.5 rounded-sm border border-border bg-white px-4 text-xs font-medium text-foreground outline-none transition-colors hover:border-primary focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 data-popup-open:border-primary data-popup-open:ring-3 data-popup-open:ring-primary/15"
      >
        <CalendarDays className="size-4 text-foreground/60" />
        <span className="whitespace-nowrap">{formatRangeLabel(range)}</span>
        <ChevronDown className="size-4 text-foreground/45" />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] max-w-[648px] overflow-y-auto p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="grid size-8 shrink-0 place-items-center rounded-sm text-foreground/70 transition-colors hover:bg-muted hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/20"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="min-w-0 truncate text-center font-sans text-sm font-bold text-foreground">
            {formatMonthLabel(months[0])} - {formatMonthLabel(months[1])}
          </div>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="grid size-8 shrink-0 place-items-center rounded-sm text-foreground/70 transition-colors hover:bg-muted hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/20"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {months.map((month) => (
            <RangeMonth
              key={month.toISOString()}
              month={month}
              onSelect={selectDate}
              range={range}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <button
            type="button"
            onClick={resetRange}
            className="h-8 rounded-sm px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-primary/20"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={selectToday}
            className="h-8 rounded-sm px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-primary/20"
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RangeMonth({
  month,
  onSelect,
  range,
}: {
  month: Date;
  onSelect: (date: Date) => void;
  range: DateRange;
}) {
  const today = startOfDay(new Date());
  const days = createMonthDays(month);

  return (
    <div className="rounded-sm bg-popover">
      <div className="px-1 text-center font-sans text-sm font-bold text-foreground">
        {formatMonthLabel(month)}
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

        {days.map((date) => {
          const isOutsideMonth = date.getMonth() !== month.getMonth();
          const isStart = range.from ? isSameDay(date, range.from) : false;
          const isEnd = range.to ? isSameDay(date, range.to) : false;
          const isToday = isSameDay(date, today);
          const isRangeDay = isWithinRange(date, range);

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelect(date)}
              className={cn(
                "grid h-8 place-items-center rounded-sm text-xs font-semibold transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/20",
                isOutsideMonth && "text-foreground/35",
                isToday && !isStart && !isEnd && "border border-primary/35 text-primary",
                isRangeDay && "bg-primary/10 text-primary",
                (isStart || isEnd) &&
                  "bg-primary text-white hover:bg-primary hover:text-white"
              )}
              aria-pressed={isStart || isEnd || isRangeDay}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { HeaderDateRangePicker };
