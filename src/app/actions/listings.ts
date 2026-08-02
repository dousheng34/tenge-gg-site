'use server';

import { revalidatePath } from 'next/cache';

import { EscrowError } from '@/lib/escrow/errors';
import { EscrowService } from '@/services/escrow.service';
import { createUserClient } from '@/lib/supabase/server';
import { createListingSchema } from '@/lib/validation/listing.schema';

export interface ListingActionState {
  ok: boolean;
  id?: string;
  error?: string;
  message?: string;
}

/** Создание лота. Схема та же, что в форме, — клиентская валидация не доверенная. */
export async function createListingAction(input: {
  title: string;
  price: string;
  description: string;
  game_type: string;
  category: string;
}): Promise<ListingActionState> {
  const parsed = createListingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION_FAILED', message: parsed.error.issues[0]?.message ?? 'Проверьте поля' };
  }

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED', message: 'Требуется вход в аккаунт.' };

  const { data, error } = await supabase
    .from('listings')
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      game_type: input.game_type,
      category: input.category,
      status: 'active',
      seller_id: auth.user.id,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: 'INTERNAL', message: error.message };

  revalidatePath('/catalog');
  revalidatePath('/');
  return { ok: true, id: data.id, message: 'Лот опубликован' };
}

/** Покупка: создаём заказ (CREATED) и получаем сумму к оплате Kaspi QR. */
export async function startOrderAction(listingId: string, idempotencyKey: string) {
  try {
    const service = await EscrowService.withUserSession();
    const result = await service.createOrder(listingId, idempotencyKey);
    revalidatePath('/orders');
    return { ok: true as const, orderId: result.orderId, status: result.status };
  } catch (error) {
    if (error instanceof EscrowError) return { ok: false as const, message: error.userMessage };
    return { ok: false as const, message: 'Не удалось создать сделку' };
  }
}

export async function sendTradeMessageAction(orderId: string, body: string) {
  const text = body.trim();
  if (text.length === 0) return { ok: false as const, message: 'Пустое сообщение' };

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, message: 'Требуется вход' };

  const { error } = await supabase
    .from('trade_messages')
    .insert({ order_id: orderId, sender_id: auth.user.id, body: text });

  if (error) return { ok: false as const, message: error.message };

  revalidatePath(`/orders/${orderId}`);
  return { ok: true as const };
}
