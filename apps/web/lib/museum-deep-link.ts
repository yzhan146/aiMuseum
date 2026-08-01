type PeriodWithHalls = { id: string; halls: Array<{ id: string }> };

export function resolveMuseumHallDeepLink(periods: PeriodWithHalls[], requestedHallId: string | null | undefined) {
  const hallId = requestedHallId?.trim();
  if (!hallId) return null;
  const period = periods.find((item) => item.halls.some((hall) => hall.id === hallId));
  return period ? { periodId: period.id, hallId } : null;
}
