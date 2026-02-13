"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Returns an `invalidate` function that clears the entire react-query cache,
 * forcing all wagmi contract read hooks to refetch fresh on-chain data.
 */
export function useInvalidateTreeQueries() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  return invalidate;
}
