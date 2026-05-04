import type { OutputOptions } from './index.js';

export interface CurvePoint {
  at: string;
  bac_promille: number;
  zone: string;
}

export interface CurveMeta {
  from: string;
  to: string;
  step_min: number;
  points: number;
  formula: string;
}

export interface DrinkMarker {
  at: string;
  label: string;
  volume_ml: number;
  abv: number;
}

export interface SVGCurveData {
  curve: CurvePoint[];
  meta: CurveMeta;
  drinks?: DrinkMarker[];
  disclaimer: string;
}

const ZONE_COLORS: Record<string, string> = {
  sober: '#e5e7eb',
  below_sweet_spot: '#86efac',
  sweet_spot: '#fde047',
  caution: '#fdba74',
  danger: '#fca5a5',
};

const ZONE_LABELS: Record<string, string> = {
  sober: 'Sober',
  below_sweet_spot: 'Below Sweet Spot',
  sweet_spot: 'Sweet Spot',
  caution: 'Caution',
  danger: 'Danger',
};

export function renderSVG(data: SVGCurveData): string {
  const { curve, meta, drinks = [], disclaimer } = data;
  if (curve.length === 0) return '';

  const width = 900;
  const height = 500;
  const margin = { top: 60, right: 40, bottom: 80, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Parse times
  const times = curve.map(p => new Date(p.at));
  const values = curve.map(p => p.bac_promille);

  const minTime = times[0].getTime();
  const maxTime = times[times.length - 1].getTime();
  const timeRange = maxTime - minTime || 1;

  const maxVal = Math.max(...values, 0.01);
  const yMax = Math.max(Math.ceil(maxVal * 1.2 * 10) / 10, 0.5);

  // Scales
  const xScale = (t: number) => margin.left + ((t - minTime) / timeRange) * plotWidth;
  const yScale = (v: number) => margin.top + plotHeight - (v / yMax) * plotHeight;

  // Zone bands (y-coordinates)
  const zones = [
    { y0: 0, y1: 0.4, color: ZONE_COLORS.below_sweet_spot, label: ZONE_LABELS.below_sweet_spot },
    { y0: 0.4, y1: 0.8, color: ZONE_COLORS.sweet_spot, label: ZONE_LABELS.sweet_spot },
    { y0: 0.8, y1: 1.2, color: ZONE_COLORS.caution, label: ZONE_LABELS.caution },
    { y0: 1.2, y1: yMax, color: ZONE_COLORS.danger, label: ZONE_LABELS.danger },
  ];

  // Build path for BAC curve
  let pathD = '';
  curve.forEach((p, i) => {
    const x = xScale(times[i].getTime());
    const y = yScale(p.bac_promille);
    pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  // Format time for x-axis
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

  // X-axis ticks (every ~2 hours or auto)
  const tickCount = Math.min(12, curve.length);
  const tickStep = Math.max(1, Math.floor(curve.length / tickCount));
  const xTicks = curve.filter((_, i) => i % tickStep === 0 || i === curve.length - 1);

  // Y-axis ticks
  const yTickStep = yMax <= 1 ? 0.2 : 0.5;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax + 0.001; v += yTickStep) {
    yTicks.push(Math.round(v * 100) / 100);
  }

  // Build SVG parts
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
  svg += `  <defs>\n`;
  svg += `    <style>\n`;
  svg += `      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\n`;
  svg += `      .title { font-size: 16px; font-weight: bold; fill: #111827; }\n`;
  svg += `      .subtitle { font-size: 11px; fill: #6b7280; }\n`;
  svg += `      .axis-label { font-size: 11px; fill: #4b5563; }\n`;
  svg += `      .tick { font-size: 10px; fill: #6b7280; }\n`;
  svg += `      .grid { stroke: #e5e7eb; stroke-width: 1; }\n`;
  svg += `      .curve { fill: none; stroke: #2563eb; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }\n`;
  svg += `      .drink-line { stroke: #9ca3af; stroke-width: 1; stroke-dasharray: 4,2; }\n`;
  svg += `      .drink-label { font-size: 9px; fill: #6b7280; }\n`;
  svg += `      .disclaimer { font-size: 9px; fill: #9ca3af; font-style: italic; }\n`;
  svg += `    </style>\n`;
  svg += `  </defs>\n`;

  // Background
  svg += `  <rect width="${width}" height="${height}" fill="#ffffff"/>\n`;

  // Title
  const fromTime = formatTime(new Date(meta.from));
  const toTime = formatTime(new Date(meta.to));
  svg += `  <text x="${margin.left}" y="30" class="title">BAC Curve — ${fromTime} to ${toTime}</text>\n`;
  svg += `  <text x="${margin.left}" y="48" class="subtitle">Formula: ${meta.formula} · ${meta.points} points · Step: ${meta.step_min}min</text>\n`;

  // Zone background bands
  zones.forEach(z => {
    const y1 = yScale(z.y1);
    const y0 = yScale(z.y0);
    const h = y0 - y1;
    if (h > 0) {
      svg += `  <rect x="${margin.left}" y="${y1}" width="${plotWidth}" height="${h}" fill="${z.color}" opacity="0.25"/>\n`;
    }
  });

  // Grid lines (y-axis)
  yTicks.forEach(v => {
    const y = yScale(v);
    svg += `  <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="grid"/>\n`;
    svg += `  <text x="${margin.left - 8}" y="${y + 3}" text-anchor="end" class="tick">${v.toFixed(1)}‰</text>\n`;
  });

  // X-axis ticks
  xTicks.forEach((p, i) => {
    const idx = curve.indexOf(p);
    const x = xScale(times[idx].getTime());
    svg += `  <line x1="${x}" y1="${margin.top + plotHeight}" x2="${x}" y2="${margin.top + plotHeight + 5}" stroke="#9ca3af" stroke-width="1"/>\n`;
    svg += `  <text x="${x}" y="${margin.top + plotHeight + 18}" text-anchor="middle" class="tick">${formatTime(times[idx])}</text>\n`;
  });

  // Drink markers
  drinks.forEach(d => {
    const dTime = new Date(d.at).getTime();
    if (dTime >= minTime && dTime <= maxTime) {
      const x = xScale(dTime);
      svg += `  <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotHeight}" class="drink-line"/>\n`;
      svg += `  <text x="${x}" y="${margin.top - 6}" text-anchor="middle" class="drink-label">${d.label}</text>\n`;
    }
  });

  // Axes
  svg += `  <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#374151" stroke-width="1.5"/>\n`; // X-axis
  svg += `  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#374151" stroke-width="1.5"/>\n`; // Y-axis

  // Y-axis label
  svg += `  <text x="18" y="${margin.top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90, 18, ${margin.top + plotHeight / 2})" class="axis-label">BAC (‰)</text>\n`;

  // BAC curve
  svg += `  <path d="${pathD}" class="curve"/>\n`;

  // Peak annotation
  const peakIdx = values.indexOf(Math.max(...values));
  if (peakIdx >= 0) {
    const px = xScale(times[peakIdx].getTime());
    const py = yScale(values[peakIdx]);
    svg += `  <circle cx="${px}" cy="${py}" r="4" fill="#dc2626" stroke="#ffffff" stroke-width="2"/>\n`;
    svg += `  <text x="${px}" y="${py - 10}" text-anchor="middle" font-size="10" font-weight="bold" fill="#dc2626">Peak: ${values[peakIdx].toFixed(2)}‰</text>\n`;
  }

  // Disclaimer
  svg += `  <text x="${margin.left}" y="${height - 20}" class="disclaimer">${disclaimer}</text>\n`;

  // Zone legend
  let legendX = width - margin.right - 200;
  let legendY = margin.top + 10;
  zones.forEach((z, i) => {
    const ly = legendY + i * 16;
    svg += `  <rect x="${legendX}" y="${ly - 8}" width="10" height="10" fill="${z.color}" opacity="0.6" stroke="#9ca3af" stroke-width="0.5"/>\n`;
    svg += `  <text x="${legendX + 16}" y="${ly}" font-size="9" fill="#4b5563">${z.label}</text>\n`;
  });

  svg += `</svg>\n`;
  return svg;
}

export function outputSVG(data: SVGCurveData, _options: OutputOptions): void {
  const svg = renderSVG(data);
  console.log(svg);
}
