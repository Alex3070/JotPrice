import type { Channel } from "../types";

/**
 * 内置购买渠道（只读，不入库）：
 * 「线下购买」+ 常见线上买菜平台，供下拉直接选择。
 */
export const BUILTIN_CHANNELS: Channel[] = [
  { id: "builtin:offline", name: "线下购买", custom: false },
  { id: "builtin:hema", name: "盒马鲜生", custom: false },
  { id: "builtin:dingdong", name: "叮咚买菜", custom: false },
  { id: "builtin:pupu", name: "朴朴超市", custom: false },
  { id: "builtin:xiaoxiang", name: "小象超市", custom: false },
  { id: "builtin:jddaojia", name: "京东到家/秒送", custom: false },
  { id: "builtin:meituan", name: "美团/淘宝闪购", custom: false },
  { id: "builtin:yonghui", name: "永辉生活", custom: false },
  { id: "builtin:sam", name: "山姆极速达", custom: false },
  { id: "builtin:meiriyouxian", name: "每日优鲜", custom: false },
  { id: "builtin:benlai", name: "本来生活", custom: false },
  { id: "builtin:duodian", name: "多点Dmall", custom: false },
  { id: "builtin:darunfa", name: "大润发优鲜", custom: false },
  { id: "builtin:tianmao", name: "天猫生鲜/京东生鲜", custom: false },
  { id: "builtin:shequ", name: "美团优选/多多买菜", custom: false },
];

/** 「线下购买」渠道 id：选择它时才记录/展示购买地点 */
export const OFFLINE_CHANNEL_ID = "builtin:offline";

/** 可见的内置渠道（已排除用户手动隐藏的；「线下购买」始终保留不可删除） */
export function getVisibleBuiltinChannels(
  hiddenBuiltinIds: string[] = []
): Channel[] {
  if (hiddenBuiltinIds.length === 0) return BUILTIN_CHANNELS;
  const hidden = new Set(hiddenBuiltinIds);
  hidden.delete(OFFLINE_CHANNEL_ID);
  return BUILTIN_CHANNELS.filter((c) => !hidden.has(c.id));
}

/** 全部渠道 = 可见内置渠道 + 用户自定义渠道 */
export function getAllChannels(
  custom: Channel[],
  hiddenBuiltinIds: string[] = []
): Channel[] {
  return [...getVisibleBuiltinChannels(hiddenBuiltinIds), ...custom];
}

/** 是否为线下渠道：「线下购买」，或自定义渠道（自定义默认视为线下） */
export function isOfflineChannel(channelId: string): boolean {
  if (channelId === OFFLINE_CHANNEL_ID) return true;
  return !BUILTIN_CHANNELS.some((c) => c.id === channelId);
}

/** 按 id 解析渠道名（内置 + 自定义），找不到返回 undefined */
export function channelName(
  id: string,
  custom: Channel[]
): string | undefined {
  return getAllChannels(custom).find((c) => c.id === id)?.name;
}
