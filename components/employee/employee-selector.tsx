"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Fuse from "fuse.js";
import { Check, CheckCircle, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Employee {
  id: string;
  name: string;
}

interface EmployeeSelectorProps {
  employees: Employee[];
  selectedEmployee: Employee | null;
  onSelect: (employee: Employee) => void;
  disabled?: boolean;
  updatedEmployees?: Set<string>;
}

export function EmployeeSelector({
  employees,
  selectedEmployee,
  onSelect,
  disabled = false,
  updatedEmployees = new Set(),
}: EmployeeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Set up Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(employees, {
      keys: ["name", "id"],
      threshold: 0.4,
      includeScore: true,
    });
  }, [employees]);

  // Filter employees based on search
  const filteredEmployees = useMemo(() => {
    if (!search.trim()) {
      return employees.slice(0, 50); // Show first 50 by default
    }
    return fuse.search(search).map((result) => result.item).slice(0, 50);
  }, [search, fuse, employees]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between md:w-[450px] h-12"
        >
          {selectedEmployee ? (
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">
                {selectedEmployee.id}
              </span>
              <span className="truncate">{selectedEmployee.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select employee...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 md:w-[450px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or ID..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No employee found.</CommandEmpty>
            <CommandGroup>
              <AnimatePresence mode="popLayout">
                {filteredEmployees.map((employee, index) => (
                  <motion.div
                    key={employee.id}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ delay: index * 0.01 }}
                  >
                    <CommandItem
                      value={`${employee.id} ${employee.name}`}
                      onSelect={() => {
                        onSelect(employee);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "cursor-pointer",
                        updatedEmployees.has(employee.id) &&
                          "bg-green-100 dark:bg-green-900/30"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedEmployee?.id === employee.id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {employee.id}
                      </span>
                      <span className="truncate flex-1">{employee.name}</span>
                      {updatedEmployees.has(employee.id) && (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 ml-2" />
                      )}
                    </CommandItem>
                  </motion.div>
                ))}
              </AnimatePresence>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
