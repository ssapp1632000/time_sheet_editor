"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, FileSpreadsheet, SkipForward, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UploadZone } from "@/components/timesheet/upload-zone";
import { EmployeeSelector } from "@/components/employee/employee-selector";
import { ComparisonTable } from "@/components/timesheet/comparison-table";
import { ComparisonSkeleton } from "@/components/timesheet/loading-skeleton";
import { DateFilterBar } from "@/components/timesheet/date-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployees } from "@/lib/hooks/use-employees";
import { useComparison } from "@/lib/hooks/use-comparison";
import type { DateFilter } from "@/types/comparison";

interface Employee {
  id: string;
  name: string;
  hasXlsx: boolean;
  dateOfJoining: string | null;
}

export default function Home() {
  const [isFileUploaded, setIsFileUploaded] = useState<boolean | null>(null); // null = checking
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const savedEmployeeIdRef = useRef<string | null>(
    typeof window !== "undefined"
      ? localStorage.getItem("timesheet-selected-employee")
      : null
  );
  const [filter, setFilter] = useState<DateFilter>(() => {
    if (typeof window === "undefined") return { mode: "month", month: format(new Date(), "yyyy-MM") };
    try {
      const saved = localStorage.getItem("timesheet-date-filter");
      if (saved) return JSON.parse(saved) as DateFilter;
    } catch { /* ignore */ }
    return { mode: "month", month: format(new Date(), "yyyy-MM") };
  });

  // Check if XLSX is already loaded on mount
  useEffect(() => {
    const checkXlsxLoaded = async () => {
      try {
        const res = await fetch("/api/employees/validate");
        if (res.ok) {
          setIsFileUploaded(true);
        } else {
          setIsFileUploaded(false);
        }
      } catch {
        setIsFileUploaded(false);
      }
    };
    checkXlsxLoaded();
  }, []);

  const {
    employees,
    dateRange,
    count: employeeCount,
    totalInXlsx,
    filteredCount,
    updatedEmployees,
    suspectDaysCounts,
    isLoading: isLoadingEmployees,
    error: employeesError,
    refresh: refreshEmployees,
  } = useEmployees(isFileUploaded === true);

  const {
    comparison,
    employee: employeeInfo,
    dateBounds,
    isLoading: isLoadingComparison,
    error: comparisonError,
    refresh: refreshComparison,
  } = useComparison(selectedEmployee?.id ?? null, filter);

  // Auto-select saved employee (or first) when employees load after upload
  useEffect(() => {
    if (isFileUploaded && employees.length > 0 && !selectedEmployee) {
      const savedId = savedEmployeeIdRef.current;
      if (savedId) {
        const saved = employees.find((e) => e.id === savedId);
        if (saved) {
          setSelectedEmployee(saved);
          savedEmployeeIdRef.current = null;
          return;
        }
      }
      setSelectedEmployee(employees[0]);
    }
  }, [isFileUploaded, employees, selectedEmployee]);

  // Persist selected employee to localStorage
  useEffect(() => {
    try {
      if (selectedEmployee) {
        localStorage.setItem("timesheet-selected-employee", selectedEmployee.id);
      }
    } catch { /* ignore */ }
  }, [selectedEmployee]);

  // Persist filter to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("timesheet-date-filter", JSON.stringify(filter));
    } catch { /* ignore */ }
  }, [filter]);

  const handleUploadSuccess = useCallback(() => {
    setIsFileUploaded(true);
    setSelectedEmployee(null);
    refreshEmployees();
  }, [refreshEmployees]);

  const handleEmployeeSelect = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
  }, []);

  const handleUpdate = useCallback(() => {
    refreshComparison();
  }, [refreshComparison]);

  // Mark employee as updated and advance to next unupdated employee
  const markUpdatedAndAdvance = useCallback(async () => {
    if (!selectedEmployee) return;

    // Mark current employee as updated on server
    try {
      await fetch(`/api/employees/${selectedEmployee.id}/updated`, {
        method: "POST",
      });
      // Refresh to get updated list
      await refreshEmployees();
    } catch (error) {
      console.error("Failed to mark employee as updated:", error);
    }

    // Find next unupdated employee
    const currentIndex = employees.findIndex((e) => e.id === selectedEmployee.id);
    const nextEmployee = employees.slice(currentIndex + 1).find(
      (e) => !updatedEmployees.has(e.id)
    );

    if (nextEmployee) {
      setSelectedEmployee(nextEmployee);
    }
  }, [selectedEmployee, employees, updatedEmployees, refreshEmployees]);

  // Called after successful apply - mark as updated and auto-advance to next employee
  const handleApplyComplete = useCallback(async () => {
    await markUpdatedAndAdvance();
  }, [markUpdatedAndAdvance]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Timesheet Editor</h1>
          </div>
          <div className="flex items-center gap-4">
            {dateRange && (
              <Badge variant="outline" className="hidden sm:flex">
                {dateRange.start} - {dateRange.end}
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {isFileUploaded === null ? (
            // Loading state while checking if XLSX is loaded
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-16"
            >
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </motion.div>
          ) : !isFileUploaded ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">
                  Upload Timesheet File
                </h2>
                <p className="text-muted-foreground">
                  Upload your XLSX timesheet file to compare with MongoDB
                  attendance records
                </p>
              </div>
              <UploadZone onUploadSuccess={handleUploadSuccess} />
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats and selector */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">
                        Select Employee
                      </CardTitle>
                      {employeeCount > 0 && (
                        <Badge variant="secondary">
                          {employeeCount} of {totalInXlsx} employees
                          {filteredCount > 0 && ` (${filteredCount} not in DB)`}
                        </Badge>
                      )}
                      {updatedEmployees.size > 0 && (
                        <Badge variant="default" className="bg-green-600">
                          {updatedEmployees.size} updated
                        </Badge>
                      )}
                    </div>
                    {dateRange && (
                      <Badge variant="outline" className="sm:hidden w-fit">
                        {dateRange.start} - {dateRange.end}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {employeesError ? (
                    <div>
                      <p className="text-destructive text-sm mb-2">{employeesError}</p>
                      {employeesError.includes("XLSX") && (
                        <button
                          onClick={() => {
                            setIsFileUploaded(false);
                            setSelectedEmployee(null);
                          }}
                          className="text-sm text-primary hover:underline"
                        >
                          Re-upload XLSX file
                        </button>
                      )}
                    </div>
                  ) : (
                    <EmployeeSelector
                      employees={employees}
                      selectedEmployee={selectedEmployee}
                      onSelect={handleEmployeeSelect}
                      disabled={isLoadingEmployees}
                      updatedEmployees={updatedEmployees}
                      suspectDaysCounts={suspectDaysCounts}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Comparison section */}
              {selectedEmployee && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{employeeInfo?.name || selectedEmployee.name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            ID: {selectedEmployee.id}
                            {employeeInfo?.company && (
                              <> &bull; {employeeInfo.company}</>
                            )}
                          </p>
                        </div>
                        {updatedEmployees.has(selectedEmployee.id) ? (
                          <Badge variant="default" className="bg-green-600 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Updated
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={markUpdatedAndAdvance}
                            className="gap-2"
                          >
                            <SkipForward className="h-4 w-4" />
                            Mark as Updated
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <DateFilterBar
                        filter={filter}
                        onFilterChange={setFilter}
                        dateBounds={dateBounds}
                        disabled={isLoadingComparison}
                      />
                      {comparisonError ? (
                        <div className="text-center py-8">
                          <p className="text-destructive mb-4">{comparisonError}</p>
                          {comparisonError.includes("XLSX") && (
                            <button
                              onClick={() => {
                                setIsFileUploaded(false);
                                setSelectedEmployee(null);
                              }}
                              className="text-sm text-primary hover:underline"
                            >
                              Re-upload XLSX file
                            </button>
                          )}
                        </div>
                      ) : isLoadingComparison ? (
                        <ComparisonSkeleton />
                      ) : comparison ? (
                        <ComparisonTable
                          data={comparison}
                          employeeId={selectedEmployee.id}
                          onUpdate={handleUpdate}
                          onApplyComplete={handleApplyComplete}
                          onRefreshEmployees={refreshEmployees}
                        />
                      ) : null}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Empty state when no employee selected */}
              {!selectedEmployee && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16"
                >
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    No Employee Selected
                  </h3>
                  <p className="text-muted-foreground">
                    Select an employee from the dropdown above to view their
                    timesheet comparison
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          Timesheet Editor &bull; Compare XLSX data with MongoDB attendance
          records
        </div>
      </footer>
    </div>
  );
}
