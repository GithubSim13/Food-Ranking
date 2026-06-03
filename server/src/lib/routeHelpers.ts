export function parseId(param: string): number | null {
  const n = Number(param);
  return isNaN(n) ? null : n;
}

export const restaurantNameSelect = { select: { name: true } } as const;
