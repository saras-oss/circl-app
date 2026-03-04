import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPricingTier(connectionCount: number): {
  tier: string;
  price: number;
  label: string;
} {
  if (connectionCount <= 1500)
    return { tier: "starter", price: 100, label: "Starter" };
  if (connectionCount <= 5000)
    return { tier: "growth", price: 300, label: "Growth" };
  if (connectionCount <= 10000)
    return { tier: "scale", price: 500, label: "Scale" };
  return { tier: "enterprise", price: 700, label: "Enterprise" };
}

export function normalizeLinkedInUrl(url: string): string {
  if (!url) return "";
  let cleaned = url.trim().toLowerCase();
  if (!cleaned.startsWith("http")) {
    cleaned = "https://" + cleaned;
  }
  cleaned = cleaned.replace(/\/+$/, "");
  return cleaned;
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(
      url.startsWith("http") ? url : `https://${url}`
    );
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  }
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
