import type { AvailabilityStatus } from "../types/domain";

export const statusLabels: Record<AvailabilityStatus, string> = {
  open: "空き",
  busy: "やや混雑",
  full: "満員"
};

export const statusClasses: Record<AvailabilityStatus, string> = {
  open: "bg-sky-600 text-white",
  busy: "bg-warning text-ink",
  full: "bg-slate-500 text-white"
};

export const statusMarkerColors: Record<AvailabilityStatus, string> = {
  open: "#0284c7",
  busy: "#f4c430",
  full: "#64748b"
};

export const statusShapes: Record<AvailabilityStatus, string> = {
  open: "●",
  busy: "▲",
  full: "■"
};
