"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The progress value between 0 and 100. */
  value: number;
  /** Optional label shown above the progress bar. */
  label?: string;
  /** Show the percentage text next to the label. */
  showValue?: boolean;
  /** Color variant for the progress indicator. */
  variant?: "default" | "success" | "warning" | "danger";
}

const variantClasses = {
  default: "bg-gray-900",
  success: "bg-emerald-600",
  warning: "bg-amber-500",
  danger: "bg-red-600",
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, label, showValue = false, variant = "default", ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value));

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {(label || showValue) && (
          <div className="flex items-center justify-between mb-1.5">
            {label && (
              <span className="text-sm font-medium text-gray-700">{label}</span>
            )}
            {showValue && (
              <span className="text-sm text-gray-500">{Math.round(clampedValue)}%</span>
            )}
          </div>
        )}
        <div
          className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || "Progress"}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-in-out",
              variantClasses[variant]
            )}
            style={{ width: `${clampedValue}%` }}
          />
        </div>
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
