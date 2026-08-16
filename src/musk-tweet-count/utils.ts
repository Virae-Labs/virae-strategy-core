export function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function readNumber(
  value: unknown,
  fallback: number,
  params?: { min?: number; max?: number },
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(
    params?.max ?? Number.POSITIVE_INFINITY,
    Math.max(params?.min ?? Number.NEGATIVE_INFINITY, parsed),
  );
}

export function readOptionalNumber(
  value: unknown,
  params?: { min?: number; max?: number },
): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(
    params?.max ?? Number.POSITIVE_INFINITY,
    Math.max(params?.min ?? Number.NEGATIVE_INFINITY, parsed),
  );
}

export function money(value: number): number {
  return Number(value.toFixed(4));
}
