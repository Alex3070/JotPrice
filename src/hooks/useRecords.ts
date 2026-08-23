import { useCallback, useEffect, useState } from "react";
import type { PriceRecord } from "../types";
import {
  addRecord,
  deleteRecord,
  getRecords,
} from "../db/database";

export function useRecords() {
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await getRecords();
    setRecords(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (rec: Omit<PriceRecord, "id" | "createdAt">) => {
      await addRecord(rec);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteRecord(id);
      await refresh();
    },
    [refresh]
  );

  return { records, loading, add, remove, refresh };
}
