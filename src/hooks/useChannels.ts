import { useCallback, useEffect, useState } from "react";
import type { Channel } from "../types";
import {
  addChannel,
  deleteChannel,
  getChannels,
} from "../db/database";

export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);

  const refresh = useCallback(async () => {
    setChannels(await getChannels());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (name: string) => {
      const created = await addChannel(name);
      await refresh();
      return created;
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteChannel(id);
      await refresh();
    },
    [refresh]
  );

  return { channels, add, remove, refresh };
}
