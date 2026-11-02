"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

export function AdminMobileFilter({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
        className="mb-3 flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#eadfd6] bg-white px-4 text-left font-sans text-base font-medium text-secondary shadow-sm md:hidden"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#b45100] text-white">
          <SlidersHorizontal className="size-[18px]" strokeWidth={1.8} />
        </span>
        <span>Filter {label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`ml-auto size-4 text-secondary/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div id={panelId} className={`${isOpen ? "block" : "hidden"} md:block`}>
        {children}
      </div>
    </>
  );
}
