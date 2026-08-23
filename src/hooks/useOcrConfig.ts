import { useCallback, useEffect, useState } from "react";
import type { OcrConfig } from "../types";
import { getOcrConfig } from "../lib/ocrConfig";

export function useOcrConfig() {
  const [config, setConfig] = useState<OcrConfig | null>(null);

  const refresh = useCallback(async () => {
    setConfig(await getOcrConfig());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { config, refresh };
}
