// Badge class maps shared by the ride, complaint and admin screens. Three
// pages had copy-pasted `statusBadge` objects; the maps and lookup helper live
// here now so a new status only has to be added once.

import type { CSSProperties, ReactNode } from "react";

export const SURGE_BADGE: Record<string, string> = {
  Peak: "badge-danger",
  High: "badge-warning",
  Elevated: "badge-info",
  Normal: "badge-success",
};

export const RIDE_STATUS_BADGE: Record<string, string> = {
  scheduled: "badge-warning",
  active: "badge-info",
  completed: "badge-success",
  cancelled: "badge-danger",
};

export const COMPLAINT_STATUS_BADGE: Record<string, string> = {
  open: "badge-warning",
  under_review: "badge-info",
  resolved: "badge-success",
  dismissed: "badge-accent",
};

export const DRIVER_STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
};

export function badgeClass(
  map: Record<string, string>,
  key: string | null | undefined,
  fallback = "badge-info"
): string {
  if (!key) return fallback;
  return map[key] ?? fallback;
}

export function surgeBadgeClass(label: string | null | undefined): string {
  return badgeClass(SURGE_BADGE, label, "badge-success");
}

interface BadgeProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Tiny wrapper so call sites do not repeat `className={`badge ${...}`}`. */
export function Badge({ children, className = "", style }: BadgeProps) {
  return (
    <span className={`badge ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}
