"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

interface EditableTimeCellProps {
  xlsxValue: string | null;
  mongoValue: string | null;
  value: string;
  onChange: (value: string) => void;
  hasDiscrepancy?: boolean;
  label: string;
}

export function EditableTimeCell({
  xlsxValue,
  mongoValue,
  value,
  onChange,
  hasDiscrepancy = false,
  label,
}: EditableTimeCellProps) {
  const [inputValue, setInputValue] = useState(value);

  // Sync with parent value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
      onChange("");
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
        onChange(normalized);
        setInputValue(normalized);
        return;
      }
    }

    // Invalid format, revert to previous value
    setInputValue(value);
  };

  // Select a source value
  const selectSource = (source: "xlsx" | "mongodb") => {
    const newValue = source === "xlsx" ? xlsxValue : mongoValue;
    if (newValue) {
      setInputValue(newValue);
      onChange(newValue);
    }
  };

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all",
        hasDiscrepancy && !hasXlsx && hasMongo && "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20",
        !hasDiscrepancy && "border-border"
      )}
    >
      {/* Label */}
      <label className="text-xs text-muted-foreground block mb-2 text-center">
        {label}
      </label>

      {/* Main editable input */}
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
            inputValue ? "text-foreground border-primary/50" : "text-muted-foreground border-border"
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
            <span className={cn(
              "font-mono text-sm",
              !hasXlsx && "line-through"
            )}>
              {hasXlsx ? xlsxValue : "--:--"}
            </span>
          </button>

          {/* Divider */}
          <div className="w-px bg-border" />

          {/* MongoDB option */}
          <button
            onClick={() => hasMongo && selectSource("mongodb")}
            disabled={!hasMongo}
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
            <span className={cn(
              "font-mono text-sm",
              !hasMongo && "line-through"
            )}>
              {hasMongo ? mongoValue : "--:--"}
            </span>
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
