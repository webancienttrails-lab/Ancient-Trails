"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Select<Value, Multiple extends boolean | undefined = false>(
  props: SelectPrimitive.Root.Props<Value, Multiple>
) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({
  children,
  className,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      type="button"
      data-slot="select-trigger"
      className={cn(
        "flex h-11 w-full items-center justify-between gap-3 rounded-sm border border-border bg-white px-3 text-left text-sm font-semibold text-foreground outline-none transition-colors select-none hover:border-primary/60 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 data-popup-open:border-primary data-popup-open:ring-3 data-popup-open:ring-primary/15 data-disabled:cursor-default data-disabled:bg-muted/35 data-disabled:text-foreground/60 data-readonly:cursor-default data-readonly:bg-muted/35",
        className,
        "h-auto min-h-11 py-2"
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        data-slot="select-icon"
        className="grid size-4 shrink-0 place-items-center text-foreground/65 transition-transform data-open:rotate-180"
      >
        <ChevronDown className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({
  className,
  ...props
}: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-none data-placeholder:text-foreground/45",
        className
      )}
      {...props}
    />
  );
}

type SelectContentProps = SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >;

function SelectContent({
  align = "start",
  alignItemWithTrigger = false,
  alignOffset = 0,
  children,
  className,
  side = "bottom",
  sideOffset = 6,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        alignOffset={alignOffset}
        className="isolate z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "z-50 w-max min-w-(--anchor-width) max-w-[calc(100vw-2rem)] origin-(--transform-origin) overflow-hidden rounded-sm border border-border bg-popover text-popover-foreground shadow-lg shadow-stone-200/70 outline-none ring-1 ring-white/70 duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            className
          )}
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow className="flex h-7 cursor-default items-center justify-center bg-popover text-foreground/55">
            <ChevronDown className="size-4 rotate-180" />
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List className="max-h-72 w-max min-w-full overflow-x-auto overflow-y-auto p-1">
            {children}
          </SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow className="flex h-7 cursor-default items-center justify-center bg-popover text-foreground/55">
            <ChevronDown className="size-4" />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  children,
  className,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "group/select-item grid min-w-full w-max cursor-default grid-cols-[1rem_max-content] items-center gap-2 rounded-sm px-2 py-2 text-sm font-semibold leading-none whitespace-nowrap text-foreground outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-primary/10 data-highlighted:text-primary",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="grid size-4 place-items-center text-primary">
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="min-w-max whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
