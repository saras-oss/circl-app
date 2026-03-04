import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-gray-900 text-white",
        gold: "bg-amber-100 text-amber-800 border border-amber-200",
        green: "bg-emerald-100 text-emerald-800 border border-emerald-200",
        secondary: "bg-gray-100 text-gray-700 border border-gray-200",
        outline: "border border-gray-300 text-gray-700 bg-transparent",
        destructive: "bg-red-100 text-red-800 border border-red-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

/**
 * Helper to get the appropriate badge variant for a Circl score.
 * 9-10 = gold, 7-8 = green, otherwise secondary.
 */
function getScoreBadgeVariant(score: number): "gold" | "green" | "secondary" {
  if (score >= 9) return "gold";
  if (score >= 7) return "green";
  return "secondary";
}

export { Badge, badgeVariants, getScoreBadgeVariant };
