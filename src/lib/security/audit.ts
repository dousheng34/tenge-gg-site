import 'server-only';

import type { LeakFinding } from './contact-leak';

/**
 * Структурированный лог событий безопасности.
 *
 * Пишем в stdout как одну JSON-строку: платформа деплоя (Vercel / Docker) собирает это
 * без дополнительной инфраструктуры, а формат готов к пересылке в SIEM.
 *
 * Персистентная таблица `security_events` описана в
 * supabase/migrations/20260803210000_security_events.sql; пока миграция не применена,
 * приложение сознательно не пишет в БД, чтобы не падать на отсутствующем объекте.
 */

export type SecurityEvent =
  | 'chat.leak_masked'
  | 'chat.payment_details_blocked'
  | 'listing.leak_masked'
  | 'listing.payment_details_blocked'
  | 'rate_limit.exceeded';

export interface SecurityLogEntry {
  event: SecurityEvent;
  actorId: string;
  entityId?: string;
  findings?: readonly LeakFinding[];
}

export function logSecurityEvent({ event, actorId, entityId, findings }: SecurityLogEntry): void {
  console.warn(
    JSON.stringify({
      level: 'warn',
      event,
      at: new Date().toISOString(),
      actor: actorId,
      entity: entityId,
      // Сохраняем вид находки, но не сам номер карты: лог не должен становиться утечкой.
      findings: findings?.map((f) => ({ kind: f.kind, severity: f.severity })),
    }),
  );
}
