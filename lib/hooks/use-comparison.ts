import useSWR from "swr";
import type { ComparisonResponse } from "@/types/comparison";

const fetcher = async (url: string): Promise<ComparisonResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch comparison");
  }
  return res.json();
};

export function useComparison(employeeId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ComparisonResponse>(
    employeeId ? `/api/comparison/${employeeId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    comparison: data?.comparison,
    employee: data?.employee,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
