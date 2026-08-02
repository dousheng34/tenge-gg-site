import { cn } from '@/lib/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Скругление подстраивается под замещаемый элемент. */
  radius?: 'none' | 'sm' | 'md' | 'full';
}

const RADIUS: Record<NonNullable<SkeletonProps['radius']>, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  full: 'rounded-full',
};

/**
 * Базовый примитив загрузки.
 *
 * a11y: чисто декоративен — скрыт от скринридеров. Статус загрузки
 * объявляет контейнер (см. ItemCardSkeletonGrid), чтобы не спамить
 * ассистивные технологии десятком одинаковых сообщений.
 */
export function Skeleton({ className, radius = 'sm', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-neutral-200/80 motion-reduce:animate-none dark:bg-neutral-800',
        RADIUS[radius],
        className,
      )}
      {...props}
    />
  );
}
