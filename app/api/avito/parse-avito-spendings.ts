export type ParsedAvitoSpendings = {
  total: number;
  presence: number;
  promotion: number;
  commission: number;
  rest: number;
};

function createEmptySpendings(): ParsedAvitoSpendings {
  return {
    total: 0,
    presence: 0,
    promotion: 0,
    commission: 0,
    rest: 0,
  };
}

function isDateInRange(date: string, dateFrom?: string, dateTo?: string) {
  if (!dateFrom || !dateTo) return true;

  return date >= dateFrom && date <= dateTo;
}

export function parseAvitoSpendings(
  data: any,
  options?: {
    dateFrom?: string;
    dateTo?: string;
  }
): ParsedAvitoSpendings {
  const result = createEmptySpendings();

  const groupings = data?.result?.groupings;

  if (!Array.isArray(groupings)) {
    return result;
  }

  for (const group of groupings) {
    const groupDate = String(group?.date || "");

    if (!isDateInRange(groupDate, options?.dateFrom, options?.dateTo)) {
      continue;
    }

    const spendings = group?.spendings;

    if (!Array.isArray(spendings)) {
      continue;
    }

    for (const spending of spendings) {
      const slug = spending?.slug;
      const value = Number(spending?.value || 0);

      if (!Number.isFinite(value)) {
        continue;
      }

      if (slug === "presence") result.presence += value;
      if (slug === "promotion") result.promotion += value;
      if (slug === "commission") result.commission += value;
      if (slug === "rest") result.rest += value;
      if (slug === "all") result.total += value;
    }
  }

  if (result.total === 0) {
    result.total =
      result.presence + result.promotion + result.commission + result.rest;
  }

  return {
    total: Math.round(result.total),
    presence: Math.round(result.presence),
    promotion: Math.round(result.promotion),
    commission: Math.round(result.commission),
    rest: Math.round(result.rest),
  };
}