import type { Unit } from "../types";

const KG_PER_JIN = 0.5; // 1 斤 = 0.5 kg
const G_PER_JIN = 500; // 1 斤 = 500 g

// 将任意单位的单价换算为「每斤」价格
export function normalizeToJin(price: number, unit: Unit): number {
  switch (unit) {
    case "jin":
      return price;
    case "kg":
      return price / KG_PER_JIN;
    case "g":
      return price / G_PER_JIN;
  }
}

export function unitLabel(unit: Unit): string {
  switch (unit) {
    case "jin":
      return "元/斤";
    case "kg":
      return "元/kg";
    case "g":
      return "元/克";
  }
}

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: "jin", label: "元/斤" },
  { value: "kg", label: "元/kg" },
  { value: "g", label: "元/克" },
];

// 将任意单位的重量换算为「斤」
export function weightToJin(weight: number, unit: Unit): number {
  switch (unit) {
    case "jin":
      return weight;
    case "kg":
      return weight / KG_PER_JIN;
    case "g":
      return weight / G_PER_JIN;
  }
}

// 按规格购买：总价 + 总重量 → 每斤价格
export function specPriceToJin(
  totalPrice: number,
  weight: number,
  unit: Unit
): number {
  const jin = weightToJin(weight, unit);
  if (jin <= 0) return 0;
  return totalPrice / jin;
}

// 重量单位的简短标签（用于“¥22.9 / 700g”这类展示）
export function weightLabel(unit: Unit): string {
  switch (unit) {
    case "jin":
      return "斤";
    case "kg":
      return "kg";
    case "g":
      return "g";
  }
}
