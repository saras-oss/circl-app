import * as React from "react";
import { cn } from "@/lib/utils";

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "animate-pulse rounded-lg bg-gray-200",
        className
      )}
      {...props}
    />
  );
});
Skeleton.displayName = "Skeleton";

/**
 * A text-shaped skeleton for simulating lines of text.
 */
const SkeletonText = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { lines?: number }
>(({ className, lines = 3, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
});
SkeletonText.displayName = "SkeletonText";

/**
 * A circular skeleton for avatars.
 */
const SkeletonCircle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <Skeleton
      ref={ref}
      className={cn("rounded-full h-10 w-10", className)}
      {...props}
    />
  );
});
SkeletonCircle.displayName = "SkeletonCircle";

export { Skeleton, SkeletonText, SkeletonCircle };
