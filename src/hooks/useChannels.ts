import { useCallback, useEffect, useState } from "react";
import type { Channel } from "../types";
import {
  addChannel,
  deleteChannel,
  getChannels,
  getHiddenBuiltinChannels,
  setHiddenBuiltinChannels,
} from "../db/database";
import { OFFLINE_CHANNEL_ID } from "../lib/channels";

export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  /** 用户手动隐藏（删除）的内置渠道 id 列表 */
  const [hidden, setHidden] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [chs, hid] = await Promise.all([
      getChannels(),
      getHiddenBuiltinChannels(),
    ]);
    setChannels(chs);
    setHidden(hid);
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

  /** 隐藏一个内置渠道（不再出现在下拉选项中），历史记录不受影响；「线下购买」不可隐藏 */
  const hideBuiltin = useCallback((id: string) => {
    if (id === OFFLINE_CHANNEL_ID) return;
    setHidden((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      void setHiddenBuiltinChannels(next);
      return next;
    });
  }, []);

  /** 恢复全部被隐藏的内置渠道 */
  const restoreBuiltins = useCallback(async () => {
    setHidden([]);
    await setHiddenBuiltinChannels([]);
  }, []);

  return { channels, hidden, add, remove, hideBuiltin, restoreBuiltins, refresh };
}
