import { after, type NextRequest } from 'next/server';

import { EscrowError } from '@/lib/escrow/errors';
import { EscrowService } from '@/services/escrow.service';

/**
 * POST /api/webhooks/kaspi
 *
 * Контракт ретраев Kaspi:
 *   200 — событие принято (в т.ч. дубликат) — ретраи прекращаются;
 *   401 — подпись неверна — не ретраить;
 *   400/422 — тело/сумма некорректны — не ретраить, разбор вручную;
 *   500 — временный сбой — Kaspi повторит доставку, обработка идемпотентна.
 */

export const runtime = 'nodejs';         // node:crypto для HMAC
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function POST(request: NextRequest): Promise<Response> {
  // Сырое тело обязательно: подпись считается до JSON-парсинга.
  const rawBody = await request.text();
  const signature = request.headers.get('x-kaspi-signature');

  try {
    const service = EscrowService.withServiceRole();
    const result = await service.handleKaspiWebhook(rawBody, signature);

    after(() => {
      console.info('[kaspi.webhook]', {
        orderId: result.orderId,
        status: result.status,
        idempotent: result.idempotent,
        reason: result.reason,
      });
    });

    return Response.json(
      { received: true, idempotent: result.idempotent, status: result.status },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof EscrowError) {
      console.error('[kaspi.webhook.rejected]', {
        code: error.code,
        message: error.message,
        context: error.context,
      });

      return Response.json(error.toJSON(), { status: error.httpStatus });
    }

    console.error('[kaspi.webhook.failed]', error);
    // 500 => Kaspi повторит; повторная обработка безопасна.
    return Response.json({ error: 'INTERNAL' }, { status: 500 });
  }
}

export function GET(): Response {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
