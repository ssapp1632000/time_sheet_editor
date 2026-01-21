"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, FileSpreadsheet, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card, CardContent } from "@/components/ui/card";

interface UploadZoneProps {
  onUploadSuccess: () => void;
}

interface UploadResult {
  success: boolean;
  employeeCount: number;
  dateRange: {
    start: string;
    end: string;
  } | null;
}

export function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        setError("Please upload an Excel file (.xlsx or .xls)");
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/xlsx/upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Upload failed");
        }

        setUploadResult(result);
        onUploadSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadSuccess]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  if (uploadResult) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">File Uploaded Successfully</h3>
            <p className="text-muted-foreground mb-4">
              Loaded {uploadResult.employeeCount} employees
              {uploadResult.dateRange && (
                <>
                  {" "}
                  for period {uploadResult.dateRange.start} to{" "}
                  {uploadResult.dateRange.end}
                </>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Select an employee below to view their timesheet comparison
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragging && "border-primary bg-primary/5",
          error && "border-destructive"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="py-12">
          <label className="flex flex-col items-center justify-center cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInputChange}
              className="hidden"
              disabled={isUploading}
            />

            {isUploading ? (
              <>
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-lg font-medium">Parsing file...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This may take a moment
                </p>
              </>
            ) : (
              <>
                <motion.div
                  animate={{ y: isDragging ? -5 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isDragging ? (
                    <FileSpreadsheet className="h-12 w-12 text-primary mb-4" />
                  ) : (
                    <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  )}
                </motion.div>
                <p className="text-lg font-medium">
                  {isDragging ? "Drop your file here" : "Upload Timesheet File"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop or click to select an Excel file (.xlsx)
                </p>
              </>
            )}

            {error && (
              <p className="text-sm text-destructive mt-4">{error}</p>
            )}
          </label>
        </CardContent>
      </Card>
    </motion.div>
  );
}
