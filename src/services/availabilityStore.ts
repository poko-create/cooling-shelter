import type { Availability, AvailabilityStatus } from "../types/domain";
import { initialAvailability } from "../data/mock/shelters";

const STORAGE_KEY = "ryodo-navi-availability";

export function loadAvailability(): Availability[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialAvailability;

  try {
    return JSON.parse(stored) as Availability[];
  } catch {
    return initialAvailability;
  }
}

export function saveAvailability(next: Availability[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function updateAvailability(
  current: Availability[],
  shelterId: string,
  status: AvailabilityStatus
): Availability[] {
  const updatedAt = new Date().toISOString();
  const exists = current.some((item) => item.shelterId === shelterId);

  if (!exists) {
    return [...current, { shelterId, status, updatedAt }];
  }

  return current.map((item) =>
    item.shelterId === shelterId ? { ...item, status, updatedAt } : item
  );
}
