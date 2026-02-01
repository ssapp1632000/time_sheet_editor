"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Trash2 } from "lucide-react";
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
import { calculateNetHoursWithDates } from "@/lib/utils/time";
import type {
  ComparisonData,
  DayComparison,
  DayUpdate,
  BulkDeleteRequest,
} from "@/types/comparison";

// Calculate time difference in minutes between two HH:mm strings
function getTimeDifferenceMinutes(
  time1: string | null,
  time2: string | null
): number | null {
  if (!time1 || !time2) return null;
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return Math.abs((h1 * 60 + m1) - (h2 * 60 + m2));
}

// Determine time diff status for cell highlighting
// Returns "large" (red), "small" (green), or null (no comparison highlight)
function getTimeDiffStatus(
  xlsxTime: string | null,
  mongoTime: string | null
): "large" | "small" | null {
  // Both times exist - compare them
  if (xlsxTime && mongoTime) {
    const diff = getTimeDifferenceMinutes(xlsxTime, mongoTime);
    if (diff === null) return null;
    return diff > 20 ? "large" : "small";
  }

  // MongoDB-only: valid time (not 00:00) = green, otherwise null (amber will show)
  if (!xlsxTime && mongoTime && mongoTime !== "00:00") {
    return "small";
  }

  return null;
}

interface ComparisonTableProps {
  data: ComparisonData;
  employeeId: string;
  onUpdate: () => void;
  onApplyComplete?: () => void;
  onRefreshEmployees?: () => void;
}

// Track the actual values for each day (now with dates)
interface DayValues {
  checkInDate: string; // DD/MM/YYYY
  checkInTime: string; // HH:mm
  checkOutDate: string; // DD/MM/YYYY
  checkOutTime: string; // HH:mm
}

export function ComparisonTable({
  data,
  employeeId,
  onUpdate,
  onApplyComplete,
  onRefreshEmployees,
}: ComparisonTableProps) {
  // Track actual values for each day (initialized with xlsx values as default, fall back to mongodb)
  const [values, setValues] = useState<Map<string, DayValues>>(() => {
    const map = new Map();
    data.days.forEach((day) => {
      // Check if XLSX has any data for this day
      const hasXlsxData = day.xlsx.in1 || day.xlsx.out2;
      // Default to xlsx values when available, otherwise use mongodb values
      map.set(day.date, {
        checkInDate: day.xlsx.in1Date || day.mongo.firstCheckInDate || day.date,
        checkInTime: hasXlsxData ? (day.xlsx.in1 || "") : (day.mongo.firstCheckIn || ""),
        checkOutDate: day.xlsx.out2Date || day.mongo.lastCheckOutDate || day.date,
        checkOutTime: hasXlsxData ? (day.xlsx.out2 || "") : (day.mongo.lastCheckOut || ""),
      });
    });
    return map;
  });

  // Track selected days (all selected by default)
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => {
    return new Set(data.days.map((day) => day.date));
  });

  // Track days marked for deletion
  const [daysToDelete, setDaysToDelete] = useState<Set<string>>(new Set());

  // Track suspect days
  const [suspectDays, setSuspectDays] = useState<Set<string>>(new Set());

  // Fetch suspect days on mount
  useEffect(() => {
    const fetchSuspectDays = async () => {
      try {
        const res = await fetch(`/api/suspect-days?employeeId=${employeeId}`);
        if (res.ok) {
          const data = await res.json();
          setSuspectDays(new Set(data.dates || []));
        }
      } catch (error) {
        console.error("Failed to fetch suspect days:", error);
      }
    };
    fetchSuspectDays();
  }, [employeeId]);

  // Toggle suspect day
  const toggleSuspectDay = useCallback(async (date: string) => {
    const isSuspect = suspectDays.has(date);

    try {
      const res = await fetch('/api/suspect-days', {
        method: isSuspect ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, date }),
      });

      if (res.ok) {
        setSuspectDays((prev) => {
          const newSet = new Set(prev);
          if (isSuspect) {
            newSet.delete(date);
          } else {
            newSet.add(date);
          }
          return newSet;
        });
        // Refresh employee list to update suspect counts
        onRefreshEmployees?.();
      }
    } catch (error) {
      console.error("Failed to toggle suspect day:", error);
    }
  }, [employeeId, suspectDays, onRefreshEmployees]);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Toggle delete mark for a day
  const toggleDeleteMark = useCallback((date: string) => {
    setDaysToDelete((prev) => {
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
        const current = newMap.get(date) || {
          checkInDate: date,
          checkInTime: "",
          checkOutDate: date,
          checkOutTime: "",
        };
        newMap.set(date, { ...current, [field]: value });
        return newMap;
      });
    },
    []
  );

  // Get current values for a day
  const getValues = (date: string): DayValues => {
    return (
      values.get(date) || {
        checkInDate: date,
        checkInTime: "",
        checkOutDate: date,
        checkOutTime: "",
      }
    );
  };

  // Calculate updates to apply (only selected days)
  const getUpdates = useCallback((): DayUpdate[] => {
    const updates: DayUpdate[] = [];

    data.days.forEach((day) => {
      // Only include selected days
      if (!selectedDays.has(day.date)) return;

      const dayValues = getValues(day.date);

      // Only include if there's actual data to update
      if (dayValues.checkInTime || dayValues.checkOutTime) {
        updates.push({
          date: day.date,
          checkInDate: dayValues.checkInDate,
          checkInTime: dayValues.checkInTime || undefined,
          checkOutDate: dayValues.checkOutDate,
          checkOutTime: dayValues.checkOutTime || undefined,
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

  // Handle bulk delete
  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const deleteRequest: BulkDeleteRequest = {
        dates: Array.from(daysToDelete),
      };

      const response = await fetch(`/api/attendance/${employeeId}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteRequest),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete");
      }

      setIsDeleteConfirmOpen(false);
      setDaysToDelete(new Set());
      onUpdate(); // Refresh data
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setIsDeleting(false);
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
        <div className="flex items-center gap-2">
          {daysToDelete.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              Delete Selected ({daysToDelete.size})
            </Button>
          )}
          <Button
            onClick={() => setIsConfirmOpen(true)}
            disabled={updates.length === 0}
          >
            Apply Selected Changes ({updates.length})
          </Button>
        </div>
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
              isMarkedForDelete={daysToDelete.has(day.date)}
              onToggleDelete={() => toggleDeleteMark(day.date)}
              isSuspect={suspectDays.has(day.date)}
              onToggleSuspect={() => toggleSuspectDay(day.date)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Update Confirmation Dialog */}
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
                  <span className="text-muted-foreground text-xs">
                    {update.checkInTime && (
                      <span>
                        IN: {update.checkInDate} {update.checkInTime}
                      </span>
                    )}
                    {update.checkInTime && update.checkOutTime && " | "}
                    {update.checkOutTime && (
                      <span>
                        OUT: {update.checkOutDate} {update.checkOutTime}
                      </span>
                    )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              You are about to delete {daysToDelete.size} attendance records
              from MongoDB. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2 text-sm">
              {Array.from(daysToDelete)
                .slice(0, 10)
                .map((date) => (
                  <div
                    key={date}
                    className="flex items-center py-1 border-b text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span className="font-mono">{date}</span>
                  </div>
                ))}
              {daysToDelete.size > 10 && (
                <div className="text-muted-foreground text-center py-2">
                  ...and {daysToDelete.size - 10} more
                </div>
              )}
            </div>
          </div>

          {deleteError && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {deleteError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Confirm Delete"}
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
  isMarkedForDelete: boolean;
  onToggleDelete: () => void;
  isSuspect: boolean;
  onToggleSuspect: () => void;
}

function DayRow({
  day,
  index,
  values,
  onValueChange,
  isSelected,
  onToggleSelect,
  isMarkedForDelete,
  onToggleDelete,
  isSuspect,
  onToggleSuspect,
}: DayRowProps) {
  const hasIssues = day.issues.length > 0;
  const hasMongoData = day.mongo.firstCheckIn || day.mongo.lastCheckOut;
  // Check if this is a MongoDB-only day (no XLSX data)
  const isMongoOnly = !day.xlsx.in1 && !day.xlsx.out2 && !day.xlsx.netWorkHours;

  // Calculate net hours with dates
  const calculatedNetHours = calculateNetHoursWithDates(
    values.checkInDate,
    values.checkInTime,
    values.checkOutDate,
    values.checkOutTime
  );

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
          !isSelected && "opacity-50",
          isMarkedForDelete && "border-destructive bg-destructive/10",
          isMongoOnly && "border-blue-400 dark:border-blue-600"
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
              {isMongoOnly && (
                <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
                  MongoDB Only
                </Badge>
              )}
              {hasMongoData && (
                <Button
                  variant={isMarkedForDelete ? "destructive" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={onToggleDelete}
                  title={isMarkedForDelete ? "Unmark for deletion" : "Mark for deletion"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
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
                <p
                  key={i}
                  className="text-xs text-yellow-700 dark:text-yellow-400"
                >
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
              xlsxDate={day.xlsx.in1Date}
              mongoValue={day.mongo.firstCheckIn}
              mongoDate={day.mongo.firstCheckInDate}
              date={values.checkInDate}
              time={values.checkInTime}
              onDateChange={(date) => onValueChange("checkInDate", date)}
              onTimeChange={(time) => onValueChange("checkInTime", time)}
              hasDiscrepancy={day.discrepancies.in1Missing}
              label="Check In (1 IN)"
              timeDiffStatus={getTimeDiffStatus(day.xlsx.in1, day.mongo.firstCheckIn) ?? undefined}
            />

            {/* Check-out cell */}
            <EditableTimeCell
              xlsxValue={day.xlsx.out2}
              xlsxDate={day.xlsx.out2Date}
              mongoValue={day.mongo.lastCheckOut}
              mongoDate={day.mongo.lastCheckOutDate}
              date={values.checkOutDate}
              time={values.checkOutTime}
              onDateChange={(date) => onValueChange("checkOutDate", date)}
              onTimeChange={(time) => onValueChange("checkOutTime", time)}
              hasDiscrepancy={day.discrepancies.out2Missing}
              label="Check Out (2 OUT)"
              timeDiffStatus={getTimeDiffStatus(day.xlsx.out2, day.mongo.lastCheckOut) ?? undefined}
            />
          </div>

          {/* Net hours comparison */}
          <div className="mt-3 pt-3 border-t flex items-center gap-4 text-sm flex-wrap">
            <span className="text-muted-foreground">Net Hours:</span>
            {/* Calculated net hours based on current values */}
            {calculatedNetHours && (
              <span className="font-mono text-primary font-semibold">
                Calculated: <strong>{calculatedNetHours}</strong>
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

          {/* Suspect day checkbox */}
          <div className="mt-3 pt-3 border-t flex items-center gap-2">
            <Checkbox
              id={`suspect-${day.date}`}
              checked={isSuspect}
              onCheckedChange={onToggleSuspect}
            />
            <label
              htmlFor={`suspect-${day.date}`}
              className={cn(
                "text-sm cursor-pointer flex items-center gap-1",
                isSuspect && "text-yellow-700 dark:text-yellow-400 font-medium"
              )}
            >
              <AlertTriangle className={cn("h-4 w-4", isSuspect && "text-yellow-600")} />
              Mark as suspect day
            </label>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
