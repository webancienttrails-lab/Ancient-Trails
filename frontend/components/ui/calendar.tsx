"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateValue(value?: string) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue) - 1;
  const day = Number(dayValue);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatCalendarDateLabel(value?: string) {
  const date = parseDateValue(value);

  if (!date) {
    return value || "";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type CalendarProps = {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  minYear?: number;
  maxYear?: number;
};

export function Calendar({
  value,
  onChange,
  className,
  minYear = 1900,
  maxYear = new Date().getFullYear(),
}: CalendarProps) {
  const selectedDate = parseDateValue(value);
  const [viewDate, setViewDate] = React.useState(() => {
    const initialDate = selectedDate || new Date();

    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const todayValue = toDateValue(new Date());

  const years = React.useMemo(
    () =>
      Array.from({ length: maxYear - minYear + 1 }, (_, index) =>
        String(maxYear - index)
      ),
    [maxYear, minYear]
  );

  const days = React.useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [viewMonth, viewYear]);

  const moveMonth = (step: number) => {
    setViewDate((current) => {
      const nextDate = new Date(
        current.getFullYear(),
        current.getMonth() + step,
        1
      );
      const nextYear = nextDate.getFullYear();

      if (nextYear < minYear || nextYear > maxYear) {
        return current;
      }

      return nextDate;
    });
  };

  const updateViewMonth = (month: string | null) => {
    if (month === null) {
      return;
    }

    setViewDate((current) => new Date(current.getFullYear(), Number(month), 1));
  };

  const updateViewYear = (year: string | null) => {
    if (year === null) {
      return;
    }

    setViewDate((current) => new Date(Number(year), current.getMonth(), 1));
  };

  return (
    <div className={cn("w-[318px] rounded-[8px] bg-popover p-1", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => moveMonth(-1)}
          className="rounded-full text-secondary/70 hover:text-primary"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </Button>

        <div className="grid min-w-0 flex-1 grid-cols-[1fr_86px] gap-2">
          <Select value={String(viewMonth)} onValueChange={updateViewMonth}>
            <SelectTrigger className="h-9 rounded-[6px] px-3 text-[12px]">
              <SelectValue>{monthNames[viewMonth] || "Month"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((month, index) => (
                <SelectItem key={month} value={String(index)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(viewYear)} onValueChange={updateViewYear}>
            <SelectTrigger className="h-9 rounded-[6px] px-3 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => moveMonth(1)}
          className="rounded-full text-secondary/70 hover:text-primary"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center font-sans text-[11px] font-semibold text-secondary/55">
        {weekDays.map((day) => (
          <span key={day} className="grid h-7 place-items-center">
            {day}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <span key={`blank-${index}`} className="h-9" />;
          }

          const date = new Date(viewYear, viewMonth, day);
          const dateValue = toDateValue(date);
          const isSelected = value === dateValue;
          const isToday = todayValue === dateValue;

          return (
            <button
              key={dateValue}
              type="button"
              onClick={() => onChange?.(dateValue)}
              className={cn(
                "grid h-9 place-items-center rounded-full font-sans text-[12px] font-semibold text-secondary transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/20",
                isToday && "text-primary",
                isSelected && "bg-primary text-white hover:bg-primary hover:text-white"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
