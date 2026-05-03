import * as chrono from 'chrono-node';
import { BAD_TIME_FORMAT, INVALID_DURATION } from '../errors/index.js';

const TIMEZONE = 'Europe/Berlin';

function getBerlinOffsetMs(utcDate: Date): number {
  const berlinParts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(utcDate);

  const getPart = (type: string) => parseInt(berlinParts.find(p => p.type === type)?.value ?? '0', 10);
  const bYear = getPart('year');
  const bMonth = getPart('month');
  const bDay = getPart('day');
  const bHour = getPart('hour');
  const bMinute = getPart('minute');
  const bSecond = getPart('second');

  const berlinTime = Date.UTC(bYear, bMonth - 1, bDay, bHour, bMinute, bSecond);
  return utcDate.getTime() - berlinTime;
}

function berlinMidnightToUTC(year: number, month: number, day: number): Date {
  const targetMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  let utcMs = targetMs;
  for (let i = 0; i < 3; i++) {
    const offset = getBerlinOffsetMs(new Date(utcMs));
    const newUtcMs = targetMs + offset;
    if (Math.abs(newUtcMs - utcMs) < 1000) {
      utcMs = newUtcMs;
      break;
    }
    utcMs = newUtcMs;
  }
  return new Date(utcMs);
}

export function parseTimestamp(input: string, referenceDate: Date = new Date()): Date {
  // Reject empty/whitespace-only strings
  if (!input || input.trim() === '') {
    throw BAD_TIME_FORMAT();
  }

  const trimmed = input.trim();

  // Fast-path for bare ISO dates (YYYY-MM-DD) → treat as Berlin midnight
  const isoDateMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoDateMatch) {
    const [year, month, day] = trimmed.split('-').map(Number);
    if (month < 1 || month > 12) {
      throw BAD_TIME_FORMAT();
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      throw BAD_TIME_FORMAT();
    }
    return berlinMidnightToUTC(year, month, day);
  }

  // Validate YYYY-MM-DD prefix if present
  const datePrefixMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (datePrefixMatch) {
    const year = parseInt(datePrefixMatch[1], 10);
    const month = parseInt(datePrefixMatch[2], 10);
    const day = parseInt(datePrefixMatch[3], 10);

    if (month < 1 || month > 12) {
      throw BAD_TIME_FORMAT();
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      throw BAD_TIME_FORMAT();
    }

    if (isNaN(Date.parse(trimmed))) {
      throw BAD_TIME_FORMAT();
    }
  }

  const results = chrono.parse(trimmed, referenceDate, { forwardDate: false });

  if (results.length === 0) {
    throw BAD_TIME_FORMAT();
  }

  const result = results[0];
  let date = result.start.date();

  if (isNaN(date.getTime())) {
    throw BAD_TIME_FORMAT();
  }

  if (!result.start.isCertain('year') && !result.start.isCertain('month') && !result.start.isCertain('day')) {
    const today = new Date(referenceDate);
    today.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());

    if (today > referenceDate) {
      today.setDate(today.getDate() - 1);
    }
    date = today;
  }

  return date;
}

export function formatISOUTC(date: Date): string {
  return date.toISOString();
}

export function formatISOLocal(date: Date): string {
  // Format to Berlin timezone with ISO offset
  const berlinDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const diffMs = berlinDate.getTime() - utcDate.getTime();
  const tzOffset = -diffMs / 60000;
  const absOffset = Math.abs(tzOffset);
  const hours = Math.floor(absOffset / 60).toString().padStart(2, '0');
  const minutes = (absOffset % 60).toString().padStart(2, '0');
  const sign = tzOffset >= 0 ? '+' : '-';
  
  const iso = date.toISOString();
  return iso.slice(0, -1) + sign + hours + ':' + minutes;
}

export function formatHumanTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}

export function formatHumanDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE,
  });
}

export function nowUTC(): Date {
  return new Date();
}

export function parseDuration(input: string): number {
  const match = input.match(/^(\d+)(m|h)$/);
  if (!match) {
    if (input === '0') return 0;
    throw INVALID_DURATION();
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  let minutes: number;
  if (unit === 'm') {
    minutes = value;
  } else {
    minutes = value * 60;
  }
  
  if (minutes < 0 || minutes > 24 * 60) {
    throw INVALID_DURATION();
  }
  
  return minutes;
}

export function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60);
}