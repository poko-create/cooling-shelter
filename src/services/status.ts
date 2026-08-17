import type { AvailabilityStatus } from "../types/domain";

export const statusLabels: Record<AvailabilityStatus, string> = {
  open: "空き",
  busy: "やや混雑",
  full: "満員"
};

export const statusClasses: Record<AvailabilityStatus, string> = {
  open: "bg-gradient-to-r from-aqua-400 to-frost-500 text-white shadow-frost",
  busy: "bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 shadow-sm",
  full: "bg-gradient-to-r from-glacial-300 to-glacial-400 text-white shadow-sm"
};

export const statusMarkerColors: Record<AvailabilityStatus, string> = {
  open: "#06b6d4",
  busy: "#fbbf24",
  full: "#94a3b8"
};

export const statusShapes: Record<AvailabilityStatus, string> = {
  open: "●",
  busy: "▲",
  full: "■"
};
