import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    data-slot="tabs"
    data-orientation={orientation}
    className={cn("flex flex-col w-full gap-6", className)}
    {...props}
  />
))
Tabs.displayName = "Tabs"

const tabsListVariants = cva(
  "inline-flex items-center justify-start border-b border-border p-0 text-muted-foreground w-full gap-6 bg-transparent",
  {
    variants: {
      variant: {
        default: "border-b border-border bg-transparent",
        line: "border-b border-border bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
    VariantProps<typeof tabsListVariants>
>(({ className, variant = "default", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-slot="tabs-list"
    data-variant={variant}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-slot="tabs-trigger"
    className={cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap pb-3 pt-1 text-sm font-medium transition-all outline-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground bg-transparent shadow-none cursor-pointer -mb-[1px]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    data-slot="tabs-content"
    className={cn("w-full outline-none focus-visible:outline-none", className)}
    {...props}
  />
))
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

