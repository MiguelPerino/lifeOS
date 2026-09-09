import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dateLabel(day: string | null) {
  return day
    ? new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : "Sem prazo";
}
