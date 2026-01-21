"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditableTimeCell } from "./editable-time-cell";
import { calculateNetHours } from "@/lib/utils/time";
import type {
  ComparisonData,
  DayComparison,
  DayUpdate,
} from "@/types/comparison";

interface ComparisonTableProps {
  data: ComparisonData;
  employeeId: string;
  onUpdate: () => void;
  onApplyComplete?: () => void;
}

// Track the actual values for each day
interface DayValues {
  checkIn: string;
  checkOut: string;
}

export function ComparisonTable({
  data,
  employeeId,
  onUpdate,
  onApplyComplete,
}: ComparisonTableProps) {
  // Track actual values for each day (initialized with xlsx values as default)
  const [values, setValues] = useState<Map<string, DayValues>>(() => {
    const map = new Map();
    data.days.forEach((day) => {
      // Default to xlsx values, fall back to mongodb if xlsx is empty
      map.set(day.date, {
        checkIn: day.xlsx.in1 || day.mongo.firstCheckIn || "",
        checkOut: day.xlsx.out2 || day.mongo.lastCheckOut || "",
      });
    });
    return map;
  });

  // Track selected days (all selected by default)
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => {
    return new Set(data.days.map((day) => day.date));
  });

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Toggle selection for a day
  const toggleDaySelection = useCallback((date: string) => {
    setSelectedDays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  }, []);

  // Select all days
  const selectAllDays = useCallback(() => {
    setSelectedDays(new Set(data.days.map((day) => day.date)));
  }, [data.days]);

  // Deselect all days
  const deselectAllDays = useCallback(() => {
    setSelectedDays(new Set());
  }, []);

  // Check if all days are selected
  const allSelected = useMemo(() => {
    return selectedDays.size === data.days.length;
  }, [selectedDays.size, data.days.length]);

  // Check if some days are selected
  const someSelected = useMemo(() => {
    return selectedDays.size > 0 && selectedDays.size < data.days.length;
  }, [selectedDays.size, data.days.length]);

  // Update value for a specific day and field
  const updateValue = useCallback(
    (date: string, field: keyof DayValues, value: string) => {
      setValues((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(date) || { checkIn: "", checkOut: "" };
        newMap.set(date, { ...current, [field]: value });
        return newMap;
      });
    },
    []
  );

  // Get current values for a day
  const getValues = (date: string): DayValues => {
    return values.get(date) || { checkIn: "", checkOut: "" };
  };

  // Calculate updates to apply (only selected days)
  const getUpdates = useCallback((): DayUpdate[] => {
    const updates: DayUpdate[] = [];

    data.days.forEach((day) => {
      // Only include selected days
      if (!selectedDays.has(day.date)) return;

      const dayValues = getValues(day.date);

      // Only include if there's actual data to update
      if (dayValues.checkIn || dayValues.checkOut) {
        updates.push({
          date: day.date,
          checkIn: dayValues.checkIn || undefined,
          checkOut: dayValues.checkOut || undefined,
        });
      }
    });

    return updates;
  }, [data.days, values, selectedDays]);

  // Handle bulk update
  const handleApplyAll = async () => {
    setIsUpdating(true);
    setUpdateError(null);

    try {
      const updates = getUpdates();
      const response = await fetch(`/api/attendance/${employeeId}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update");
      }

      setIsConfirmOpen(false);
      onUpdate(); // Refresh data

      // Call onApplyComplete to mark employee as updated and auto-advance
      if (onApplyComplete) {
        onApplyComplete();
      }
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Update failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const updates = getUpdates();

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  selectAllDays();
                } else {
                  deselectAllDays();
                }
              }}
              className={someSelected ? "opacity-50" : ""}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium cursor-pointer"
            >
              Select All
            </label>
          </div>
          <Badge variant={data.totalIssues > 0 ? "warning" : "success"}>
            {data.totalIssues > 0
              ? `${data.totalIssues} issues found`
              : "No issues"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {selectedDays.size}/{data.days.length} days selected
          </span>
        </div>
        <Button
          onClick={() => setIsConfirmOpen(true)}
          disabled={updates.length === 0}
        >
          Apply Selected Changes ({updates.length})
        </Button>
      </div>

      {/* Days list */}
      <ScrollArea className="h-[calc(100vh-350px)] pr-4">
        <div className="space-y-3">
          {data.days.map((day, index) => (
            <DayRow
              key={day.date}
              day={day}
              index={index}
              values={getValues(day.date)}
              onValueChange={(field, value) =>
                updateValue(day.date, field, value)
              }
              isSelected={selectedDays.has(day.date)}
              onToggleSelect={() => toggleDaySelection(day.date)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Updates</DialogTitle>
            <DialogDescription>
              You are about to update {updates.length} attendance records in
              MongoDB. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2 text-sm">
              {updates.slice(0, 10).map((update) => (
                <div
                  key={update.date}
                  className="flex items-center justify-between py-1 border-b"
                >
                  <span className="font-mono">{update.date}</span>
                  <span className="text-muted-foreground">
                    {update.checkIn && `IN: ${update.checkIn}`}
                    {update.checkIn && update.checkOut && " | "}
                    {update.checkOut && `OUT: ${update.checkOut}`}
                  </span>
                </div>
              ))}
              {updates.length > 10 && (
                <div className="text-muted-foreground text-center py-2">
                  ...and {updates.length - 10} more
                </div>
              )}
            </div>
          </div>

          {updateError && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {updateError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button onClick={handleApplyAll} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Confirm Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Individual day row component
interface DayRowProps {
  day: DayComparison;
  index: number;
  values: DayValues;
  onValueChange: (field: keyof DayValues, value: string) => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function DayRow({ day, index, values, onValueChange, isSelected, onToggleSelect }: DayRowProps) {
  const hasIssues = day.issues.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
    >
      <Card
        className={cn(
          "transition-all",
          hasIssues && "border-yellow-400 dark:border-yellow-600",
          day.discrepancies.lowHours && "bg-yellow-50/50 dark:bg-yellow-950/20",
          !isSelected && "opacity-50"
        )}
      >
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-3">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                className="mr-1"
              />
              <span className="font-mono text-sm">{day.date}</span>
              <span className="text-muted-foreground font-normal">
                {day.dayName}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasIssues ? (
                <Badge variant="warning" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {day.issues.length} issue{day.issues.length > 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  OK
                </Badge>
              )}
              {day.xlsx.netWorkHours && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {day.xlsx.netWorkHours}
                </Badge>
              )}
            </div>
          </div>

          {/* Issue descriptions */}
          {hasIssues && (
            <div className="mt-2 space-y-1">
              {day.issues.map((issue, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
                  {issue}
                </p>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="py-3 px-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Check-in cell */}
            <EditableTimeCell
              xlsxValue={day.xlsx.in1}
              mongoValue={day.mongo.firstCheckIn}
              value={values.checkIn}
              onChange={(value) => onValueChange("checkIn", value)}
              hasDiscrepancy={day.discrepancies.in1Missing}
              label="Check In (1 IN)"
            />

            {/* Check-out cell */}
            <EditableTimeCell
              xlsxValue={day.xlsx.out2}
              mongoValue={day.mongo.lastCheckOut}
              value={values.checkOut}
              onChange={(value) => onValueChange("checkOut", value)}
              hasDiscrepancy={day.discrepancies.out2Missing}
              label="Check Out (2 OUT)"
            />
          </div>

          {/* Net hours comparison */}
          <div className="mt-3 pt-3 border-t flex items-center gap-4 text-sm flex-wrap">
            <span className="text-muted-foreground">Net Hours:</span>
            {/* Calculated net hours based on current values */}
            {calculateNetHours(values.checkIn, values.checkOut) && (
              <span className="font-mono text-primary font-semibold">
                Calculated: <strong>{calculateNetHours(values.checkIn, values.checkOut)}</strong>
              </span>
            )}
            {day.xlsx.netWorkHours && (
              <span className="font-mono text-muted-foreground">
                XLSX: {day.xlsx.netWorkHours}
              </span>
            )}
            {day.mongo.totalHours && (
              <span className="font-mono text-muted-foreground">
                MongoDB: {day.mongo.totalHours}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
