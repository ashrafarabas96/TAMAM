'use client';

import { type QueryKey, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Page } from '@tamam/shared-types';

import { ApiError } from '@/lib/api/errors';

interface CursorListOptions<T> {
  queryKey: QueryKey;
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>;
  enabled?: boolean;
  refetchInterval?: number | false;
  staleTime?: number;
}

/** Keyset ("load more") pagination over `{ items, nextCursor }` responses. */
export function useCursorList<T>({
  queryKey,
  fetchPage,
  enabled = true,
  refetchInterval = false,
  staleTime,
}: CursorListOptions<T>) {
  const query = useInfiniteQuery<
    Page<T>,
    ApiError,
    { pages: Page<T>[]; pageParams: unknown[] },
    QueryKey,
    string | undefined
  >({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
    refetchInterval,
    ...(staleTime !== undefined ? { staleTime } : {}),
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  return {
    items,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    hasMore: query.hasNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    isLoadingMore: query.isFetchingNextPage,
  };
}
