import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "destructive"
  | "outline";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  destructive: "border-transparent bg-destructive/10 text-destructive",
  outline: "border-border text-muted-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}
