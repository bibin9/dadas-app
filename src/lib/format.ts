export function formatAED(amount: number | undefined | null): string {
  return `AED ${(amount ?? 0).toFixed(2)}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
