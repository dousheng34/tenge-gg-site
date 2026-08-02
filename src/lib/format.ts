const TENGE = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 });

export function kzt(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  return `${TENGE.format(Math.round(Number.isFinite(n) ? n : 0))} ₸`;
}

export function fee(price: number, rate = 0.05): number {
  return Math.round(price * rate);
}

export function initials(name: string | null | undefined): string {
  return (name?.trim()?.[0] ?? '?').toUpperCase();
}

const RTF = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['day', 86400],
  ['hour', 3600], ['minute', 60], ['second', 1],
];

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  for (const [unit, sec] of UNITS) {
    if (Math.abs(diff) >= sec || unit === 'second') {
      return RTF.format(Math.round(diff / sec), unit);
    }
  }
  return '';
}

/** Разбивка оставшегося времени для countdown авто-релиза escrow. */
export function countdown(target: string | null | undefined, now = Date.now()) {
  if (!target) return null;
  const ms = Date.parse(target) - now;
  if (!Number.isFinite(ms) || ms <= 0) return { done: true, h: 0, m: 0, s: 0 };
  const total = Math.floor(ms / 1000);
  return { done: false, h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export const GAMES = [
  { slug: 'pubg', title: 'PUBG Mobile', glyph: '🎯' },
  { slug: 'freefire', title: 'Free Fire', glyph: '🔥' },
  { slug: 'mlbb', title: 'Mobile Legends', glyph: '⚔️' },
  { slug: 'standoff', title: 'Standoff 2', glyph: '🔫' },
  { slug: 'genshin', title: 'Genshin Impact', glyph: '🌸' },
  { slug: 'roblox', title: 'Roblox', glyph: '🧱' },
  { slug: 'cs2', title: 'CS2', glyph: '💣' },
  { slug: 'other', title: 'Другое', glyph: '🎮' },
] as const;

export const CATEGORIES = [
  { slug: 'currency', title: 'Валюта и донат' },
  { slug: 'account', title: 'Аккаунты' },
  { slug: 'items', title: 'Предметы и скины' },
  { slug: 'boost', title: 'Прокачка' },
] as const;

export function gameTitle(slug: string | null | undefined): string {
  return GAMES.find((g) => g.slug === slug)?.title ?? slug ?? 'tenge.gg';
}

export function gameGlyph(slug: string | null | undefined): string {
  return GAMES.find((g) => g.slug === slug)?.glyph ?? '🎮';
}
