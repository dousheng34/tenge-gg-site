import { ItemCardSkeletonGrid } from '@/components/ui/skeleton/ItemCardSkeleton';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function CatalogLoading() {
  return (
    <div className="section py-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-3 w-52" />
      <div className="mt-6 flex flex-col gap-2">
        <Skeleton className="h-9 w-full" />
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-7 w-24" />)}
        </div>
      </div>
      <ItemCardSkeletonGrid className="mt-6" count={8} />
    </div>
  );
}
