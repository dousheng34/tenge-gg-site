/**
 * Анти-байпас сканер переписки.
 *
 * Задача — не «цензура», а защита сделки: если стороны уходят в Telegram и платят
 * картой напрямую, escrow не работает, арбитраж невозможен, и пострадавшего защитить
 * нечем. Поэтому реквизиты (карта, IBAN) блокируются жёстко, а контакты маскируются
 * с предупреждением.
 *
 * Важно: «Kaspi» сам по себе НЕ является нарушением — это платёжный метод платформы.
 * Ловим не слово, а намерение платить напрямую («переведи на карту», «мимо сайта»).
 */

import { collapseSeparators, foldForKeywords, foldPlain } from './text';

export type LeakKind =
  | 'card'
  | 'iban'
  | 'phone'
  | 'telegram'
  | 'email'
  | 'external_link'
  | 'bypass_intent';

export type LeakSeverity = 'block' | 'mask';

export interface LeakFinding {
  kind: LeakKind;
  severity: LeakSeverity;
  /** Фрагмент исходного текста — уходит в лог безопасности, не покупателю. */
  sample: string;
}

export interface ScanResult {
  /** Текст с замаскированными контактами. Пустой не бывает: маска сохраняет длину сообщения. */
  text: string;
  findings: LeakFinding[];
  /** true — сообщение содержит платёжные реквизиты и не должно попасть в БД. */
  blocked: boolean;
}

export const MASK = '[скрыто]';

/** Домены платформы: свои ссылки не считаются уводом. */
const OWN_HOSTS = ['tenge.gg', 'www.tenge.gg', 'localhost'];

interface Rule {
  kind: LeakKind;
  severity: LeakSeverity;
  pattern: RegExp;
  /** Дополнительная проверка совпадения (например, Luhn для карты). */
  confirm?: (match: string) => boolean;
}

/** Luhn: отсекает «просто 16 цифр» вроде игрового ID от реального номера карты. */
export function isLuhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits.charCodeAt(i) - 48;
    if (value < 0 || value > 9) return false;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

const RULES: readonly Rule[] = [
  {
    kind: 'card',
    severity: 'block',
    pattern: /\b(?:\d[ \t.\-]?){12,18}\d\b/g,
    confirm: (match) => isLuhnValid(match.replace(/\D/g, '')),
  },
  {
    kind: 'iban',
    severity: 'block',
    pattern: /\bKZ[ \t.\-]?\d{2}[ \t.\-]?(?:[A-Z0-9][ \t.\-]?){12,28}\b/gi,
  },
  {
    kind: 'phone',
    severity: 'mask',
    pattern: /(?:\+?7|8)[ \t.\-()]*7\d{2}(?:[ \t.\-()]*\d){7}/g,
  },
  {
    kind: 'email',
    severity: 'mask',
    pattern: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi,
  },
  {
    // Lookbehind исключает хвост e-mail: в «seller@gmail.com» это не Telegram-хендл.
    kind: 'telegram',
    severity: 'mask',
    pattern: /(?:(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/[a-z0-9_]{3,32}|(?<![\w.%+-])@[a-z0-9_]{4,32})/gi,
  },
  {
    kind: 'external_link',
    severity: 'mask',
    pattern: /\b(?:https?:\/\/|www\.)[^\s<>"']{4,}/gi,
    confirm: (match) => {
      const host = match.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/:?#]/)[0] ?? '';
      return !OWN_HOSTS.includes(host.toLowerCase());
    },
  },
];

/**
 * Фразы «давай мимо сайта».
 *
 * Ищутся по свёрнутому тексту, поэтому «м и м о   с а й т а» и «т.е.л.е.г.а» тоже ловятся.
 * Русские фразы проверяются по plain-фолду, латиница — по гомоглифному (ловит «tелеgram»).
 * Отдельное слово «напрямую» сознательно не включено: слишком частое в обычной переписке.
 */
const BYPASS_PHRASES_RU: readonly string[] = [
  'мимосайта',
  'внесайта',
  'безгаранта',
  'обходсайта',
  'переведина',
  'переводнакарту',
  'кинуназакарту',
  'кинешьнакарту',
  'накартупереведи',
  'оплатанапрямую',
  'платинапрямую',
  'купинапрямую',
  'вотсап',
  'вацап',
  'вайбер',
  'дискорд',
  'телеграм',
  'телега',
  'тгнапиши',
  'напишивтг',
];

const BYPASS_PHRASES_LATIN: readonly string[] = [
  'whatsapp',
  'viber',
  'discord',
  'telegram',
  'skype',
];

function overlaps(ranges: Array<[number, number]>, start: number, end: number): boolean {
  return ranges.some(([from, to]) => start < to && end > from);
}

/**
 * Сканирует текст, маскирует контакты и сообщает, нужно ли блокировать отправку.
 * Исходный текст не мутируется; результат детерминирован.
 */
export function scanForContactLeaks(input: string): ScanResult {
  const findings: LeakFinding[] = [];
  const masked: Array<[number, number]> = [];
  let text = input;

  for (const rule of RULES) {
    const matches = [...input.matchAll(rule.pattern)];

    for (const match of matches) {
      const value = match[0];
      const start = match.index ?? -1;
      if (start < 0) continue;
      if (rule.confirm && !rule.confirm(value)) continue;
      if (overlaps(masked, start, start + value.length)) continue;

      masked.push([start, start + value.length]);
      findings.push({ kind: rule.kind, severity: rule.severity, sample: value.slice(0, 64) });
    }
  }

  // Замена справа налево, чтобы не сдвигать индексы ещё не обработанных совпадений.
  const blocking = findings.filter((f) => f.severity === 'block').length > 0;
  const ordered = [...masked].sort((a, b) => b[0] - a[0]);
  for (const [start, end] of ordered) {
    text = `${text.slice(0, start)}${MASK}${text.slice(end)}`;
  }

  const foldedLatin = foldForKeywords(input);
  const foldedPlain = foldPlain(input);

  const hitBypass =
    BYPASS_PHRASES_RU.some((phrase) => foldedPlain.includes(phrase)) ||
    BYPASS_PHRASES_LATIN.some((phrase) => foldedLatin.includes(phrase));

  if (hitBypass) {
    findings.push({ kind: 'bypass_intent', severity: 'mask', sample: 'off-platform intent' });
  }

  return { text, findings, blocked: blocking };
}

/** Человеческие формулировки для тоста и лога. */
export const LEAK_LABELS: Readonly<Record<LeakKind, string>> = Object.freeze({
  card: 'номер карты',
  iban: 'банковский счёт',
  phone: 'телефон',
  telegram: 'Telegram',
  email: 'e-mail',
  external_link: 'внешняя ссылка',
  bypass_intent: 'предложение уйти с платформы',
});

export function describeFindings(findings: readonly LeakFinding[]): string {
  const kinds = [...new Set(findings.map((f) => f.kind))].map((kind) => LEAK_LABELS[kind]);
  return kinds.join(', ');
}
