"use client";

import { useCallback, useMemo } from "react";
import {
  parse,
  format,
  addMonths,
  subMonths,
  startOfMonth,
  isBefore,
  isAfter,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { parseDateString, formatDateString } from "@/lib/utils/time";
import type { DateFilter, DateBounds, DateFilterMode } from "@/types/comparison";

interface DateFilterProps {
  filter: DateFilter;
  onFilterChange: (filter: DateFilter) => void;
  dateBounds: DateBounds | null;
  disabled?: boolean;
}

export function DateFilterBar({
  filter,
  onFilterChange,
  dateBounds,
  disabled,
}: DateFilterProps) {
  const earliestDate = useMemo(
    () => (dateBounds ? parseDateString(dateBounds.earliest) : null),
    [dateBounds]
  );
  const latestDate = useMemo(
    () => (dateBounds ? parseDateString(dateBounds.latest) : null),
    [dateBounds]
  );

  const currentMonth = useMemo(() => {
    if (filter.month) {
      return parse(filter.month, "yyyy-MM", new Date());
    }
    return new Date();
  }, [filter.month]);

  const canGoPrev = useMemo(() => {
    if (!earliestDate) return false;
    const prevMonth = startOfMonth(subMonths(currentMonth, 1));
    return !isBefore(prevMonth, startOfMonth(earliestDate));
  }, [currentMonth, earliestDate]);

  const canGoNext = useMemo(() => {
    if (!latestDate) return false;
    const nextMonth = startOfMonth(addMonths(currentMonth, 1));
    return !isAfter(nextMonth, startOfMonth(latestDate));
  }, [currentMonth, latestDate]);

  const handleModeChange = useCallback(
    (mode: DateFilterMode) => {
      if (mode === "month") {
        onFilterChange({
          mode: "month",
          month: filter.month || format(new Date(), "yyyy-MM"),
        });
      } else if (mode === "range") {
        onFilterChange({
          mode: "range",
          startDate: dateBounds?.earliest,
          endDate: dateBounds?.latest,
        });
      } else {
        onFilterChange({ mode: "all" });
      }
    },
    [filter.month, dateBounds, onFilterChange]
  );

  const handlePrevMonth = useCallback(() => {
    const prev = subMonths(currentMonth, 1);
    onFilterChange({ mode: "month", month: format(prev, "yyyy-MM") });
  }, [currentMonth, onFilterChange]);

  const handleNextMonth = useCallback(() => {
    const next = addMonths(currentMonth, 1);
    onFilterChange({ mode: "month", month: format(next, "yyyy-MM") });
  }, [currentMonth, onFilterChange]);

  const handleStartDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      onFilterChange({
        mode: "range",
        startDate: formatDateString(date),
        endDate: filter.endDate || dateBounds?.latest,
      });
    },
    [filter.endDate, dateBounds, onFilterChange]
  );

  const handleEndDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      onFilterChange({
        mode: "range",
        startDate: filter.startDate || dateBounds?.earliest,
        endDate: formatDateString(date),
      });
    },
    [filter.startDate, dateBounds, onFilterChange]
  );

  const rangeStartDate = useMemo(
    () => (filter.startDate ? parseDateString(filter.startDate) : null),
    [filter.startDate]
  );
  const rangeEndDate = useMemo(
    () => (filter.endDate ? parseDateString(filter.endDate) : null),
    [filter.endDate]
  );

  return (
    <div className="flex flex-col gap-3 mb-4 pb-4 border-b">
      {/* Mode selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground mr-1">View:</span>
        {(["month", "range", "all"] as const).map((mode) => (
          <Button
            key={mode}
            variant={filter.mode === mode ? "default" : "outline"}
            size="sm"
            onClick={() => handleModeChange(mode)}
            disabled={disabled}
            className="capitalize"
          >
            {mode}
          </Button>
        ))}
        {dateBounds && (
          <Badge variant="outline" className="ml-auto text-xs">
            {dateBounds.earliestSource === "dateOfJoining"
              ? "Joined"
              : dateBounds.earliestSource === "xlsx"
                ? "XLSX start"
                : "First record"}
            : {dateBounds.earliest}
          </Badge>
        )}
      </div>

      {/* Mode-specific controls */}
      {filter.mode === "month" && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrevMonth}
            disabled={disabled || !canGoPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleNextMonth}
            disabled={disabled || !canGoNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {filter.mode === "range" && (
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                className={cn(
                  "justify-start text-left font-normal gap-2",
                  !rangeStartDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {rangeStartDate
                  ? format(rangeStartDate, "dd MMM yyyy")
                  : "Start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={rangeStartDate ?? undefined}
                onSelect={handleStartDateSelect}
                disabled={(date) => {
                  if (earliestDate && isBefore(date, earliestDate)) return true;
                  if (rangeEndDate && isAfter(date, rangeEndDate)) return true;
                  return false;
                }}
                defaultMonth={rangeStartDate ?? earliestDate ?? undefined}
              />
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                className={cn(
                  "justify-start text-left font-normal gap-2",
                  !rangeEndDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {rangeEndDate
                  ? format(rangeEndDate, "dd MMM yyyy")
                  : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={rangeEndDate ?? undefined}
                onSelect={handleEndDateSelect}
                disabled={(date) => {
                  if (latestDate && isAfter(date, latestDate)) return true;
                  if (rangeStartDate && isBefore(date, rangeStartDate))
                    return true;
                  return false;
                }}
                defaultMonth={rangeEndDate ?? latestDate ?? undefined}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {filter.mode === "all" && dateBounds && (
        <div className="text-sm text-muted-foreground">
          Showing all days from {dateBounds.earliest} to {dateBounds.latest}
        </div>
      )}
    </div>
  );
}
