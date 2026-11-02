import { apiRequest, ApiError } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export const reportPeriods = [{ days: 30, label: "Last 30 days" }, { days: 90, label: "Last 90 days" }, { days: 180, label: "Last 6 months" }, { days: 365, label: "Last 12 months" }] as const;
export type ReportDays = typeof reportPeriods[number]["days"];
export type ReportMetric = { value: number; previous: number; change: number | null };
export type AdminReport = {
  days: ReportDays; generatedAt: string; currency: "INR";
  period: { start: string; end: string; previousStart: string };
  metrics: Record<"revenue" | "bookings" | "openEnquiries" | "travellers", ReportMetric>;
  trend: Array<{ label: string; start: string; end: string; bookings: number; revenue: number }>;
  categories: Array<{ name: string; revenue: number; percentage: number }>;
  topTours: Array<{ tourId: string; name: string; category: string; bookings: number; revenue: number; fillRate: number | null }>;
  pipeline: Array<{ status: string; count: number }>;
  enquiryTotal: number; closedPercentage: number; excludedCurrencyBookings: number;
};
export type AdminReportInvoice = {
  id: string; invoiceNumber: string; date: string; clientName: string; members: number;
  tourId: string; tourName: string; beforeTax: number; cgst: number; sgst: number;
  tcs: number; withTax: number; fare: number; total: number; remark: string;
};

export async function getAdminReport(days: ReportDays, signal?: AbortSignal) {
  const session = getAdminSession();
  if (!session?.sessionId) throw new ApiError(401, "Please sign in to continue");
  return apiRequest<AdminReport>(`/api/admin/dashboard/reports?days=${days}`, { headers: { "X-Session-Id": session.sessionId }, signal });
}

export async function getAdminReportInvoices(signal?: AbortSignal) {
  const session = getAdminSession();
  if (!session?.sessionId) throw new ApiError(401, "Please sign in to continue");
  return apiRequest<{ invoices: AdminReportInvoice[]; tours: Array<{ tourId: string; tourName: string }> }>("/api/admin/dashboard/reports/invoices", { headers: { "X-Session-Id": session.sessionId }, signal });
}

function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function createReportCsv(report: AdminReport): string {
  const rows: Array<Array<string | number>> = [
    ["Ancient Trails reports"], ["Period start", report.period.start], ["Period end (exclusive)", report.period.end], ["Generated at", report.generatedAt], ["Currency", report.currency], [],
    ["Metric", "Current period", "Previous period"],
    ["Verified revenue", report.metrics.revenue.value, report.metrics.revenue.previous],
    ["Tour bookings", report.metrics.bookings.value, report.metrics.bookings.previous],
    ["Open enquiries", report.metrics.openEnquiries.value, report.metrics.openEnquiries.previous],
    ["Active travellers", report.metrics.travellers.value, report.metrics.travellers.previous], [],
    ["Period", "Bookings", "Revenue (INR)"], ...report.trend.map(bucket => [bucket.label, bucket.bookings, bucket.revenue]), [],
    ["Category", "Revenue (INR)", "Share (%)"], ...report.categories.map(category => [category.name, category.revenue, category.percentage.toFixed(2)]), [],
    ["Tour", "Category", "Bookings", "Revenue (INR)", "Fill rate (%)"], ...report.topTours.map(tour => [tour.name, tour.category, tour.bookings, tour.revenue, tour.fillRate === null ? "Not available" : tour.fillRate.toFixed(1)]), [],
    ["Enquiry status", "Count"], ...report.pipeline.map(item => [item.status, item.count]),
  ];
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadReportCsv(report: AdminReport) {
  const url = URL.createObjectURL(new Blob([createReportCsv(report)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ancient-trails-reports-${report.days}d-${report.generatedAt.slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
