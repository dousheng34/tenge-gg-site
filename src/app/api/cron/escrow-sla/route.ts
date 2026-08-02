import type { NextRequest } from 'next/server';

import { EscrowService } from '@/services/escrow.service';

/**
 * GET /api/cron/escrow-sla — экспирация Kaspi QR и авто-релиз средств по SLA.
 * Вызывается Vercel Cron (или любым планировщиком) с заголовком
 * `Authorization: Bearer $ESCROW_CRON_SECRET`.
 *
 * Операция идемпотентна: строки берутся `FOR UPDATE SKIP LOCKED`,
 * параллельные запуски не конфликтуют и не выплачивают дважды.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  const secret = process.env.ESCROW_CRON_SECRET;
  const provided = request.headers.get('authorization');

  if (!secret || provided !== `Bearer ${secret}`) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const stats = await EscrowService.withServiceRole().runSlas();
    return Response.json({ ok: true, ...stats }, { status: 200 });
  } catch (error) {
    console.error('[escrow.cron.failed]', error);
    return Response.json({ error: 'INTERNAL' }, { status: 500 });
  }
}
