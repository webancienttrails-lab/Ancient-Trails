"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

function Popover({ modal = false, ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" modal={modal} {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  children,
  sideOffset = 8,
  align = "start",
  ...props
}: PopoverPrimitive.Popup.Props & {
  sideOffset?: number;
  align?: PopoverPrimitive.Positioner.Props["align"];
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "rounded-[8px] border border-border bg-popover p-4 text-popover-foreground shadow-[0_18px_42px_rgba(50,50,50,0.16)] outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            className
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
