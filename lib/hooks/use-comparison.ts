import { useMemo } from "react";
import useSWR from "swr";
import type {
  ComparisonResponse,
  DateFilter,
  DateBounds,
} from "@/types/comparison";

const fetcher = async (url: string): Promise<ComparisonResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch comparison");
  }
  return res.json();
};

export function useComparison(
  employeeId: string | null,
  filter?: DateFilter
) {
  const url = useMemo(() => {
    if (!employeeId) return null;
    const params = new URLSearchParams();
    if (filter?.mode) params.set("mode", filter.mode);
    if (filter?.month) params.set("month", filter.month);
    if (filter?.startDate) params.set("startDate", filter.startDate);
    if (filter?.endDate) params.set("endDate", filter.endDate);
    const qs = params.toString();
    return `/api/comparison/${employeeId}${qs ? `?${qs}` : ""}`;
  }, [employeeId, filter?.mode, filter?.month, filter?.startDate, filter?.endDate]);

  const { data, error, isLoading, mutate } = useSWR<ComparisonResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    comparison: data?.comparison,
    employee: data?.employee,
    dateBounds: data?.dateBounds ?? null,
    activeFilter: data?.activeFilter ?? null,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
