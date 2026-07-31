"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Select<Value = string>({
  modal = false,
  ...props
}: SelectPrimitive.Root.Props<Value, false>) {
  return <SelectPrimitive.Root data-slot="select" modal={modal} {...props} />;
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-11 w-full items-center justify-between gap-3 rounded-[6px] border border-border bg-white px-4 font-sans text-[13px] font-medium text-secondary outline-none transition-colors hover:border-primary/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 data-[popup-open]:border-primary data-[popup-open]:ring-3 data-[popup-open]:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 [&_[data-slot=select-value][data-placeholder]]:text-secondary/45",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        data-slot="select-icon"
        className="grid size-4 shrink-0 place-items-center text-secondary/55 transition-transform data-[popup-open]:rotate-180"
      >
        <ChevronDown className="size-4" strokeWidth={1.9} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("min-w-0 truncate text-left", className)}
      {...props}
    />
  );
}

function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        sideOffset={6}
        className="z-50"
        alignItemWithTrigger={false}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-[260px] min-w-[var(--anchor-width)] overflow-hidden rounded-[8px] border border-border bg-popover p-1 text-popover-foreground shadow-[0_18px_42px_rgba(50,50,50,0.16)] outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List className="max-h-[248px] overflow-y-auto overscroll-contain">
            {children}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "grid cursor-pointer grid-cols-[1fr_18px] items-center gap-3 rounded-[6px] px-3 py-2.5 font-sans text-[13px] font-medium text-secondary outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary data-[selected]:text-primary",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="grid size-4 place-items-center text-primary">
        <Check className="size-4" strokeWidth={2.2} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
