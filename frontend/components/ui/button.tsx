import type { ComponentProps } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariantStyles = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[24px] border border-transparent bg-clip-padding cursor-pointer text-button font-medium whitespace-nowrap transition-all duration-300 ease-[ease] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-button-outline bg-button-outline text-white hover:bg-white hover:text-button-outline",
        outline:
          "border-button-outline bg-white text-button-outline hover:bg-button-outline hover:text-white aria-expanded:bg-button-outline aria-expanded:text-white",
        secondary:
          "border-button-outline bg-button-outline text-white hover:bg-white hover:text-button-outline aria-expanded:bg-button-outline aria-expanded:text-white",
        ghost:
          "text-button-outline hover:text-button-outline aria-expanded:text-button-outline",
        destructive:
          "bg-primary/10 text-brand-text hover:bg-primary/20 focus-visible:border-primary/40 focus-visible:ring-primary/20",
        link: "text-button-outline underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-1.5 px-6 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        class: "rounded-[24px]",
      },
      {
        variant: "outline",
        class: "rounded-[24px]",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonVariantProps = VariantProps<typeof buttonVariantStyles> & {
  className?: string
}

function buttonVariants({
  className,
  size = "default",
  variant = "default",
}: ButtonVariantProps = {}) {
  const effectiveVariant = variant ?? "default"

  return cn(
    buttonVariantStyles({ variant: effectiveVariant, size, className }),
    effectiveVariant === "default" && "text-[17px]"
  )
}

type ButtonProps = Omit<ComponentProps<typeof ButtonPrimitive>, "className"> &
  VariantProps<typeof buttonVariantStyles> & {
    className?: string
  }

function Button({
  className,
  nativeButton,
  render,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      nativeButton={nativeButton ?? (render ? false : undefined)}
      render={render}
      {...props}
    />
  )
}

function ButtonArrow({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-3 w-7 shrink-0", className)}
      data-slot="button-arrow"
    />
  )
}

export { Button, ButtonArrow, buttonVariants }
