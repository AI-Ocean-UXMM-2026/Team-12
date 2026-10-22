// SQL DATE utilities. Do not convert calendar dates through the viewer's timezone.
export function businessToday(
  timeZone = process.env.BUSINESS_TIMEZONE ?? "Asia/Yangon",
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function expectedDeliveryDate(deliveryDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate))
    throw new Error("Use an ISO calendar date (YYYY-MM-DD).");
  const date = new Date(`${deliveryDate}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== deliveryDate
  )
    throw new Error("Invalid calendar date.");
  date.setUTCDate(date.getUTCDate() + 3);
  return date.toISOString().slice(0, 10);
}
