"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Inbox, IndianRupee, RefreshCw, SlidersHorizontal, Search, Users, CalendarCheck, type LucideIcon } from "lucide-react";
import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { getAdminReport, getAdminReportInvoices, reportPeriods, type AdminReport, type AdminReportInvoice, type ReportDays, type ReportMetric } from "@/lib/reports";
import styles from "./reports.module.css";

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const money = (amount: number) => `₹${number.format(Math.round(amount || 0))}`;
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
type InvoiceRow = AdminReportInvoice & { dateValue: Date };

function toCsv(rows: InvoiceRow[]) {
  const cell = (value: unknown) => `"${String(value ?? "").replace(/[\r\n]+/g, " ").replace(/"/g, '""')}"`;
  const contents = [["Invoice No.", "Date", "Client Name", "Members", "Tour Name", "Before Tax", "CGST", "SGST", "TCS", "With Tax", "Flight / Train Fare", "Final Amount", "Remark"], ...rows.map(row => [row.invoiceNumber, dateFormat.format(row.dateValue), row.clientName, row.members, row.tourName, row.beforeTax, row.cgst, row.sgst, row.tcs, row.withTax, row.fare, row.total, row.remark])];
  const url = URL.createObjectURL(new Blob(["\uFEFF" + contents.map(line => line.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "ancient-trails-invoice-report.csv"; link.click(); URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [days, setDays] = useState<ReportDays>(30);
  const [attempt, setAttempt] = useState(0);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [invoices, setInvoices] = useState<AdminReportInvoice[]>([]);
  const [tours, setTours] = useState<Array<{ tourId: string; tourName: string }>>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tourFilter, setTourFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [showMobileMemberFilter, setShowMobileMemberFilter] = useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    Promise.all([getAdminReport(days, controller.signal), getAdminReportInvoices(controller.signal)]).then(([reportResponse, invoiceResponse]) => {
      if (controller.signal.aborted) return;
      setReport(reportResponse.data); setInvoices(invoiceResponse.data.invoices); setTours(invoiceResponse.data.tours);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load invoice reports.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [days, attempt]);

  const rows = useMemo<InvoiceRow[]>(() => invoices.map(invoice => ({ ...invoice, dateValue: new Date(invoice.date) })).sort((a, b) => b.dateValue.getTime() - a.dateValue.getTime()), [invoices]);
  const filteredRows = useMemo(() => {
    const now = new Date(); const cutoff = dateFilter === "30" ? 30 : dateFilter === "90" ? 90 : dateFilter === "year" ? 365 : 0;
    const search = query.trim().toLowerCase();
    return rows.filter(row => (!search || [row.invoiceNumber, row.clientName, row.tourName].some(value => value.toLowerCase().includes(search))) && (tourFilter === "all" || row.tourId === tourFilter) && (!cutoff || (now.getTime() - row.dateValue.getTime()) <= cutoff * 86400000) && (memberFilter === "all" || row.members === Number(memberFilter)));
  }, [rows, query, tourFilter, dateFilter, memberFilter]);
  const metrics = report ? [
    { label: "Total revenue", value: money(report.metrics.revenue.value), icon: IndianRupee, metric: report.metrics.revenue },
    { label: "Tour bookings", value: number.format(report.metrics.bookings.value), icon: CalendarCheck, metric: report.metrics.bookings },
    { label: "Open enquiries", value: number.format(report.metrics.openEnquiries.value), icon: Inbox, metric: report.metrics.openEnquiries },
    { label: "Active travellers", value: number.format(report.metrics.travellers.value), icon: Users, metric: report.metrics.travellers },
  ] : [];

  return <AdminDashboardShell activeLabel="Report"><main className={styles.reports} aria-busy={loading}>
    <header className={styles.header}><div><h1>Reports &amp; Invoices</h1><p>View tour invoices, track tax collections and export financial records.</p></div><div className={styles.toolbar}>
      <select aria-label="Report period" value={days} onChange={event => setDays(Number(event.target.value) as ReportDays)}>{reportPeriods.map(period => <option key={period.days} value={period.days}>{period.label}</option>)}</select>
      <button type="button" className={styles.outlineButton} onClick={() => { setQuery(""); setTourFilter("all"); setDateFilter("all"); setMemberFilter("all"); setDays(30); }}><RefreshCw size={14}/>Reset Filters</button>
      <button type="button" className={styles.outlineButton} disabled={!filteredRows.length} onClick={() => toCsv(filteredRows)}><Download size={14}/>Export CSV</button>
      <button type="button" className={styles.primaryButton} onClick={() => window.print()}><Download size={14}/>Export / Print PDF</button>
    </div></header>
    {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={() => setAttempt(value => value + 1)}>Retry <RefreshCw size={13}/></button></div> : null}
    <section className={styles.metrics} aria-label="Report totals">{metrics.map(({ label, value, icon: Icon, metric }) => <MetricCard key={label} label={label} value={value} icon={Icon} metric={metric}/>)}</section>
    <section className={styles.invoicePanel}>
      <div className={styles.mobileInvoiceHeader}>
        <h2>Invoice Reports</h2>
        <button type="button" aria-label="Toggle member filter" aria-expanded={showMobileMemberFilter} onClick={() => setShowMobileMemberFilter(value => !value)}><SlidersHorizontal size={19}/></button>
      </div>
      <div className={styles.mobileInvoiceControls}>
        <label className={styles.mobileSearch}><Search size={18}/><input aria-label="Search invoice or customer" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search invoice or customer..."/></label>
        <label><span className={styles.srOnly}>Invoice date</span><select aria-label="Invoice date" value={dateFilter} onChange={event => setDateFilter(event.target.value)}><option value="all">All Dates</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="year">Last 12 months</option></select></label>
        <label><span className={styles.srOnly}>Tour</span><select aria-label="Tour" value={tourFilter} onChange={event => setTourFilter(event.target.value)}><option value="all">All Tours</option>{tours.map(tour => <option key={tour.tourId} value={tour.tourId}>{tour.tourName}</option>)}</select></label>
        {showMobileMemberFilter ? <label className={styles.mobileMemberFilter}><span className={styles.srOnly}>Members</span><select aria-label="Members" value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">All Members</option>{[...new Set(rows.map(row => row.members))].sort((a,b) => a-b).map(count => <option key={count} value={count}>{count} {count === 1 ? "Member" : "Members"}</option>)}</select></label> : null}
        <div className={styles.mobileExports}>
          <button type="button" disabled={!filteredRows.length} onClick={() => toCsv(filteredRows)}><Download size={15}/>Export CSV</button>
          <button type="button" onClick={() => window.print()}><Download size={15}/>Export PDF</button>
        </div>
      </div>
      <div className={styles.filters}><label className={styles.searchLabel}>Search invoice or customer<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by invoice no., name or tour..."/></label>
        <label>Tour<select value={tourFilter} onChange={event => setTourFilter(event.target.value)}><option value="all">All Tours</option>{tours.map(tour => <option key={tour.tourId} value={tour.tourId}>{tour.tourName}</option>)}</select></label>
        <label>Invoice date<select value={dateFilter} onChange={event => setDateFilter(event.target.value)}><option value="all">All Dates</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="year">Last 12 Months</option></select></label>
        <label>Members<select value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">All Members</option>{[...new Set(rows.map(row => row.members))].sort((a,b) => a-b).map(count => <option key={count} value={count}>{count} {count === 1 ? "Member" : "Members"}</option>)}</select></label>
      </div>
      <div className={styles.mobileInvoices}>
        {filteredRows.map(row => <article className={styles.invoiceCard} key={row.id}>
          <div className={styles.invoiceCardTop}><strong>{row.invoiceNumber}</strong><time dateTime={row.date}>{dateFormat.format(row.dateValue)}</time></div>
          <div className={styles.invoiceCardMain}><h3>{row.clientName}</h3><p>{row.tourName}</p><div className={styles.invoiceCardSummary}><span>{row.members} {row.members === 1 ? "Member" : "Members"}</span><div><small>Final Amount</small><strong>{money(row.total)}</strong></div></div></div>
          <button type="button" className={styles.invoiceDetailsButton} aria-expanded={expandedInvoiceId === row.id} onClick={() => setExpandedInvoiceId(current => current === row.id ? null : row.id)}><Eye size={16}/>{expandedInvoiceId === row.id ? "Hide Invoice Details" : "View Invoice Details"}</button>
          {expandedInvoiceId === row.id ? <dl className={styles.invoiceBreakdown}>
            <div><dt>Before tax</dt><dd>{money(row.beforeTax)}</dd></div><div><dt>CGST</dt><dd>{money(row.cgst)}</dd></div><div><dt>SGST</dt><dd>{money(row.sgst)}</dd></div><div><dt>TCS</dt><dd>{money(row.tcs)}</dd></div><div><dt>With tax</dt><dd>{money(row.withTax)}</dd></div><div><dt>Flight / Train fare</dt><dd>{money(row.fare)}</dd></div><div><dt>Remark</dt><dd>{row.remark || "—"}</dd></div>
          </dl> : null}
        </article>)}
        {!filteredRows.length ? <div className={styles.mobileEmpty}>{loading ? "Loading invoice records…" : error ? "Invoice records unavailable." : "No invoices match the selected filters."}</div> : null}
      </div>
      <div className={styles.tableScroll} data-horizontal-scroll><table className={styles.table}><thead><tr>{["Invoice No.", "Date", "Client Name", "Members", "Tour Name", "Before Tax", "CGST", "SGST", "TCS", "With Tax", "Flight / Train Fare", "Final Amount", "Remark"].map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>
        {filteredRows.map(row => <tr key={row.id}><td data-label="Invoice No.">{row.invoiceNumber}</td><td data-label="Date">{dateFormat.format(row.dateValue)}</td><td data-label="Client Name">{row.clientName}</td><td data-label="Members">{row.members}</td><td data-label="Tour Name"><span className={styles.tourPill}>{row.tourName}</span></td><td data-label="Before Tax">{money(row.beforeTax)}</td><td data-label="CGST">{money(row.cgst)}</td><td data-label="SGST">{money(row.sgst)}</td><td data-label="TCS">{money(row.tcs)}</td><td data-label="With Tax">{money(row.withTax)}</td><td data-label="Flight / Train Fare">{money(row.fare)}</td><td data-label="Final Amount"><strong>{money(row.total)}</strong></td><td data-label="Remark">{row.remark || "—"}</td></tr>)}
        {!filteredRows.length ? <tr><td colSpan={13} className={styles.tableEmpty}>{loading ? "Loading invoice records…" : error ? "Invoice records unavailable." : "No invoices match the selected filters."}</td></tr> : null}
      </tbody></table></div>
    </section>
    {report && report.excludedCurrencyBookings > 0 ? <p className={styles.note}>{number.format(report.excludedCurrencyBookings)} non-INR payment records are excluded from revenue totals.</p> : null}
  </main></AdminDashboardShell>;
}

function MetricCard({ label, value, icon: Icon, metric }: { label: string; value: string; icon: LucideIcon; metric: ReportMetric }) {
  const change = metric.change; return <article className={styles.metric}><div className={styles.metricLabel}>{label}<span className={styles.metricIcon}><Icon size={17}/></span></div><strong>{value}</strong><div className={styles.trend}><span>{change === null ? "↗ New" : `${change > 0 ? "↗" : "↘"} ${Math.abs(change).toFixed(1)}%`}</span><span>vs prior period</span></div></article>;
}
