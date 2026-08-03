'use server';

import { revalidatePath } from 'next/cache';

import { createUserClient } from '@/lib/supabase/server';
import { isListingStatus, type ListingStatus } from '@/lib/validation/profile.schema';

export interface AdminActionState {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Модерация лота сотрудником. Роль проверяется функцией is_staff() в базе,
 * а не флагом в браузере, как в legacy admin.html.
 *
 * Статусы сделок здесь сознательно не меняются: единственный законный путь —
 * escrow-стейт-машина (см. docs/ESCROW.md и /arbitration).
 */
export async function moderateListingAction(
  listingId: string,
  status: ListingStatus,
): Promise<AdminActionState> {
  if (!isListingStatus(status)) {
    return { ok: false, error: 'VALIDATION_FAILED', message: 'Неизвестный статус лота' };
  }

  const supabase = await createUserClient();

  const { data: staff, error: roleError } = await supabase.rpc('is_staff');
  if (roleError || staff !== true) {
    return { ok: false, error: 'FORBIDDEN', message: 'Нужна роль admin или arbiter.' };
  }

  const { error } = await supabase.from('listings').update({ status }).eq('id', listingId);
  if (error) return { ok: false, error: 'INTERNAL', message: error.message };

  revalidatePath('/admin');
  revalidatePath('/catalog');
  revalidatePath(`/lot/${listingId}`);
  revalidatePath('/');

  return { ok: true, message: status === 'active' ? 'Лот опубликован' : 'Лот скрыт из каталога' };
}
