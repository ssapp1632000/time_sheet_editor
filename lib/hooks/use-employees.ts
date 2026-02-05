import useSWR from "swr";
import type { DateRange } from "@/types/xlsx";

interface Employee {
  id: string;
  name: string;
  hasXlsx: boolean;
}

interface ValidatedEmployeesResponse {
  employees: Employee[];
  dateRange: DateRange | null;
  count: number;
  totalInXlsx: number;
  totalInMongo: number;
  mongoOnlyCount: number;
  filteredCount: number;
  updatedEmployees: string[];
  suspectDaysCounts: Record<string, number>;
}

const fetcher = async (url: string): Promise<ValidatedEmployeesResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch employees");
  }
  return res.json();
};

export function useEmployees(enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<ValidatedEmployeesResponse>(
    enabled ? "/api/employees/validate" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    employees: data?.employees ?? [],
    dateRange: data?.dateRange ?? null,
    count: data?.count ?? 0,
    totalInXlsx: data?.totalInXlsx ?? 0,
    totalInMongo: data?.totalInMongo ?? 0,
    mongoOnlyCount: data?.mongoOnlyCount ?? 0,
    filteredCount: data?.filteredCount ?? 0,
    updatedEmployees: new Set(data?.updatedEmployees ?? []),
    suspectDaysCounts: data?.suspectDaysCounts ?? {},
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
