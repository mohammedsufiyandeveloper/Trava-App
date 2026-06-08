import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string or object as DD/MM/YYYY using UTC components.
 * This prevents 1-day shifts caused by local timezone offsets.
 */
/**
 * Parses a local date-time string (YYYY-MM-DDTHH:mm or YYYY-MM-DD) as Indian Standard Time (IST)
 */
export function parseIST(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // If it's already an ISO string with timezone, parse it directly
  if (dateStr.includes('Z') || dateStr.includes('+')) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  
  // If it's just YYYY-MM-DD (date only), add default time
  let finalStr = dateStr;
  if (!dateStr.includes('T') && dateStr.includes('-')) {
    finalStr = `${dateStr}T00:00`;
  }
  
  const d = new Date(`${finalStr}:00+05:30`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date string or object as DD/MM/YYYY HH:mm in IST.
 */
export function formatDateUTC(date: string | Date | null | undefined, includeTime: boolean = true): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  // Using Intl.DateTimeFormat to reliably get IST components regardless of local environment
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value;

  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const hours = getPart('hour');
  const minutes = getPart('minute');

  const dateStr = `${day}/${month}/${year}`;
  return includeTime ? `${dateStr} ${hours}:${minutes}` : dateStr;
}

/**
 * Formats a date in Indian Standard Time (IST)
 */
export function formatIST(date: string | Date | null | undefined, formatStr: string = "dd/MM/yyyy"): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  // Using Intl.DateTimeFormat to reliably extract IST components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value;

  const year = parseInt(getPart('year')!);
  const month = parseInt(getPart('month')!) - 1;
  const day = parseInt(getPart('day')!);
  const hour = parseInt(getPart('hour')!);
  const minute = parseInt(getPart('minute')!);
  const second = parseInt(getPart('second')!);

  const pseudoISTDate = new Date(year, month, day, hour, minute, second);

  return format(pseudoISTDate, formatStr);
}
