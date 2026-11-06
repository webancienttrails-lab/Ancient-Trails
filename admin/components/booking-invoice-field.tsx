"use client";

import { createContext, useContext } from "react";

export const BookingInvoiceEditorContext = createContext<{
  values: Record<string, string>;
  editing: boolean;
  disabled: boolean;
  onChange: (field: string, value: string) => void;
}>({ values: {}, editing: false, disabled: false, onChange: () => {} });

export function BookingInvoiceText({ field, children }: { field: string; children: string | number }) {
  const editor = useContext(BookingInvoiceEditorContext);
  const value = editor.values[field] ?? String(children);
  if (!editor.editing) return <span className="whitespace-pre-wrap">{value}</span>;
  return <textarea
    aria-label={field.replace(/[.:-]/g, " ")}
    value={value}
    disabled={editor.disabled}
    maxLength={4000}
    rows={Math.min(6, Math.max(1, value.split("\n").length))}
    onChange={(event) => editor.onChange(field, event.target.value)}
    className="min-h-7 w-full min-w-[40px] resize-y rounded border border-primary/30 bg-orange-50/40 px-1 py-0.5 text-inherit font-inherit outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
  />;
}
