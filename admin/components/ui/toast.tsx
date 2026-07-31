"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastItem = Required<Pick<ToastInput, "title" | "variant" | "duration">> &
  Pick<ToastInput, "description"> & {
    id: string;
  };

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);
let toastCounter = 0;

const toastIcons: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const toastStyles: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-white text-foreground [&_[data-toast-icon]]:text-emerald-600",
  error: "border-red-200 bg-white text-foreground [&_[data-toast-icon]]:text-red-600",
  info: "border-primary/25 bg-white text-foreground [&_[data-toast-icon]]:text-primary",
  warning: "border-amber-200 bg-white text-foreground [&_[data-toast-icon]]:text-amber-600",
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const Icon = toastIcons[item.variant];

  React.useEffect(() => {
    const timerId = window.setTimeout(() => {
      onDismiss(item.id);
    }, item.duration);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [item.duration, item.id, onDismiss]);

  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto grid grid-cols-[22px_minmax(0,1fr)_24px] gap-3 rounded-[8px] border p-4 shadow-[0_18px_45px_rgba(50,50,50,0.16)] ring-1 ring-white/70 backdrop-blur data-[state=open]:animate-in data-[state=open]:slide-in-from-right-3 data-[state=open]:fade-in-0",
        toastStyles[item.variant]
      )}
      data-state="open"
    >
      <Icon data-toast-icon className="mt-0.5 size-5" strokeWidth={2} />
      <div className="min-w-0">
        <p className="font-sans text-[13px] font-bold leading-[1.35] text-foreground">
          {item.title}
        </p>
        {item.description ? (
          <p className="mt-1 font-sans text-[12px] leading-[1.45] text-foreground/68">
            {item.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="grid size-6 place-items-center rounded-full text-foreground/45 transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label="Dismiss notification"
      >
        <X className="size-4" strokeWidth={1.9} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback((input: ToastInput) => {
    const id = `toast-${Date.now()}-${toastCounter++}`;

    setItems((current) =>
      [
        ...current,
        {
          id,
          title: input.title,
          description: input.description,
          variant: input.variant || "info",
          duration: input.duration ?? 4200,
        },
      ].slice(-4)
    );

    return id;
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) =>
        toast({ title, description, variant: "success" }),
      error: (title, description) =>
        toast({ title, description, variant: "error" }),
      info: (title, description) =>
        toast({ title, description, variant: "info" }),
      warning: (title, description) =>
        toast({ title, description, variant: "warning" }),
    }),
    [dismiss, toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[2147483647] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3 sm:right-5 sm:top-5">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
