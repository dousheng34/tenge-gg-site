'use client';

import { useRef } from 'react';

import { Modal } from '@/components/ui/modal';
import { CreateListingForm } from './CreateListingForm';
import type { CreateListingValues } from '@/lib/validation/listing.schema';

export interface CreateListingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateListingValues) => Promise<void>;
}

/** Композиция Modal + форма: первый фокус уходит на поле названия. */
export function CreateListingModal({ open, onClose, onSubmit }: CreateListingModalProps) {
  const firstFieldRef = useRef<HTMLElement>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый лот"
      description="Escrow защищает сделку: деньги придут после подтверждения покупателем."
      size="lg"
      initialFocusRef={firstFieldRef}
    >
      <CreateListingForm
        onSubmit={async (values) => {
          await onSubmit(values);
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
