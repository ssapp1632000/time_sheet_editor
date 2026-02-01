"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parse, format } from "date-fns";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface EditableTimeCellProps {
  xlsxValue: string | null;
  xlsxDate: string; // DD/MM/YYYY
  mongoValue: string | null;
  mongoDate: string | null; // DD/MM/YYYY
  date: string; // Current selected date DD/MM/YYYY
  time: string; // Current selected time HH:mm
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  hasDiscrepancy?: boolean;
  label: string;
  // Time difference status: "large" (>20min), "small" (<=20min), or null (can't compare)
  timeDiffStatus?: "large" | "small" | null;
}

// Parse DD/MM/YYYY to Date object
function parseDate(dateStr: string): Date | undefined {
  try {
    return parse(dateStr, "dd/MM/yyyy", new Date());
  } catch {
    return undefined;
  }
}

// Format Date to DD/MM/YYYY
function formatDate(date: Date): string {
  return format(date, "dd/MM/yyyy");
}

export function EditableTimeCell({
  xlsxValue,
  xlsxDate,
  mongoValue,
  mongoDate,
  date,
  time,
  onDateChange,
  onTimeChange,
  hasDiscrepancy = false,
  label,
  timeDiffStatus,
}: EditableTimeCellProps) {
  const [inputValue, setInputValue] = useState(time);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Sync with parent value
  useEffect(() => {
    setInputValue(time);
  }, [time]);

  const hasXlsx = xlsxValue !== null && xlsxValue !== "";
  const hasMongo = mongoValue !== null && mongoValue !== "";

  // Handle input change with validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Auto-format: add colon after 2 digits
    if (/^\d{2}$/.test(newValue)) {
      setInputValue(newValue + ":");
    }
  };

  // Handle blur - validate and update parent
  const handleBlur = () => {
    // Empty value
    if (inputValue === "" || inputValue === "--:--") {
      onTimeChange("");
      setInputValue("");
      return;
    }

    // Validate HH:mm format
    if (/^\d{1,2}:\d{2}$/.test(inputValue)) {
      const [hours, minutes] = inputValue.split(":");
      const h = parseInt(hours, 10);
      const m = parseInt(minutes, 10);

      // Validate hours and minutes
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const normalized = hours.padStart(2, "0") + ":" + minutes;
        onTimeChange(normalized);
        setInputValue(normalized);
        return;
      }
    }

    // Invalid format, revert to previous value
    setInputValue(time);
  };

  // Select a source value (both time and date)
  const selectSource = (source: "xlsx" | "mongodb") => {
    if (source === "xlsx" && hasXlsx) {
      setInputValue(xlsxValue!);
      onTimeChange(xlsxValue!);
      onDateChange(xlsxDate);
    } else if (source === "mongodb" && hasMongo && mongoDate) {
      setInputValue(mongoValue!);
      onTimeChange(mongoValue!);
      onDateChange(mongoDate);
    }
  };

  // Navigate to previous day
  const prevDay = () => {
    const currentDate = parseDate(date);
    if (currentDate) {
      const newDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
      onDateChange(formatDate(newDate));
    }
  };

  // Navigate to next day
  const nextDay = () => {
    const currentDate = parseDate(date);
    if (currentDate) {
      const newDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      onDateChange(formatDate(newDate));
    }
  };

  // Handle calendar date selection
  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onDateChange(formatDate(selectedDate));
      setIsCalendarOpen(false);
    }
  };

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all",
        // Time difference indicators take priority
        timeDiffStatus === "large" && "bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600",
        timeDiffStatus === "small" && "bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600",
        // Only show amber if no timeDiffStatus and there's a discrepancy (XLSX has data but MongoDB is missing)
        !timeDiffStatus &&
          hasDiscrepancy &&
          hasXlsx &&
          !hasMongo &&
          "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20",
        // Default border when nothing else applies
        !timeDiffStatus && !hasDiscrepancy && "border-border"
      )}
    >
      {/* Label */}
      <label className="text-xs text-muted-foreground block mb-2 text-center">
        {label}
      </label>

      {/* Date selector with arrows */}
      <div className="flex items-center justify-center gap-1 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={prevDay}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs h-7 px-2"
              type="button"
            >
              {date}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={parseDate(date)}
              onSelect={handleCalendarSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={nextDay}
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Main editable time input */}
      <div className="flex justify-center mb-3">
        <input
          type="text"
          value={inputValue || ""}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder="--:--"
          className={cn(
            "w-24 text-center text-xl font-mono font-semibold",
            "bg-background border-2 rounded-md px-2 py-1.5",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
            "transition-all",
            inputValue
              ? "text-foreground border-primary/50"
              : "text-muted-foreground border-border"
          )}
        />
      </div>

      {/* Source options */}
      {(hasXlsx || hasMongo) && (
        <div className="flex justify-center gap-3 text-xs">
          {/* XLSX option */}
          <button
            onClick={() => hasXlsx && selectSource("xlsx")}
            disabled={!hasXlsx}
            type="button"
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded transition-all",
              "hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary",
              hasXlsx
                ? "text-foreground cursor-pointer"
                : "text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              XLSX
            </span>
            <span className={cn("font-mono text-sm", !hasXlsx && "line-through")}>
              {hasXlsx ? xlsxValue : "--:--"}
            </span>
            {hasXlsx && (
              <span className="text-[9px] text-muted-foreground">{xlsxDate}</span>
            )}
          </button>

          {/* Divider */}
          <div className="w-px bg-border" />

          {/* MongoDB option */}
          <button
            onClick={() => hasMongo && selectSource("mongodb")}
            disabled={!hasMongo}
            type="button"
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded transition-all",
              "hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary",
              hasMongo
                ? "text-foreground cursor-pointer"
                : "text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              MongoDB
            </span>
            <span className={cn("font-mono text-sm", !hasMongo && "line-through")}>
              {hasMongo ? mongoValue : "--:--"}
            </span>
            {hasMongo && mongoDate && (
              <span className="text-[9px] text-muted-foreground">{mongoDate}</span>
            )}
          </button>
        </div>
      )}

      {/* No data indicator */}
      {!hasXlsx && !hasMongo && (
        <div className="text-xs text-muted-foreground text-center">
          No source data available
        </div>
      )}
    </div>
  );
}
