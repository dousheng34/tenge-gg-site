import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { EscrowError } from '@/lib/escrow/errors';

/**
 * Верификация подписи вебхука Kaspi QR.
 *
 * Ожидаемый формат заголовка (конфигурируется в кабинете мерчанта):
 *   X-Kaspi-Signature: t=<unix_ts>,v1=<hex_hmac_sha256>
 * где подпись считается от строки `${t}.${rawBody}` на секрете мерчанта.
 *
 * Защита: constant-time сравнение + окно защиты от replay.
 */

const DEFAULT_TOLERANCE_SECONDS = 300;

export interface KaspiSignatureHeader {
  timestamp: number;
  signature: string;
}

export function parseSignatureHeader(header: string | null): KaspiSignatureHeader {
  if (!header) {
    throw new EscrowError('SIGNATURE_INVALID', 'отсутствует заголовок подписи');
  }

  const parts = header.split(',').reduce<Record<string, string>>((acc, chunk) => {
    const [key, value] = chunk.split('=', 2);
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const timestamp = Number.parseInt(parts.t ?? '', 10);
  const signature = parts.v1 ?? '';

  if (!Number.isFinite(timestamp) || signature.length === 0) {
    throw new EscrowError('SIGNATURE_INVALID', 'некорректный формат подписи');
  }

  return { timestamp, signature };
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function verifyKaspiSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): void {
  if (!secret) {
    throw new EscrowError('INTERNAL', 'KASPI_WEBHOOK_SECRET не сконфигурирован');
  }

  const { timestamp, signature } = parseSignatureHeader(header);

  const skew = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (skew > toleranceSeconds) {
    throw new EscrowError('SIGNATURE_INVALID', 'подпись просрочена (replay window)', { skew });
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  if (!safeEqualHex(expected, signature)) {
    throw new EscrowError('SIGNATURE_INVALID', 'подпись не совпадает');
  }
}
