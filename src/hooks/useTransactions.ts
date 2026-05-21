import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, onSnapshot,
  orderBy, limit, startAfter, getDocs,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction } from '../types';

// Only stream the most recent 50 transactions live.
// Older pages are fetched on-demand via loadMore() to keep Firestore reads minimal.
const PAGE_SIZE = 50;

export function useTransactions(userId: string | null) {
  const queryClient                   = useQueryClient();
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);

  // Real-time subscription pushes data into TanStack Query cache.
  useEffect(() => {
    if (!userId) {
      queryClient.setQueryData(['transactions', userId], []);
      setHasMore(false);
      setLastVisible(null);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(PAGE_SIZE)
    );

    return onSnapshot(q, (snapshot) => {
      const fresh = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      // Preserve any older pages already loaded via loadMore.
      queryClient.setQueryData(['transactions', userId], (prev: Transaction[] = []) =>
        prev.length > PAGE_SIZE
          ? [...fresh, ...prev.slice(PAGE_SIZE)]
          : fresh
      );
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    });
  }, [userId, queryClient]);

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions', userId],
    queryFn:  () => [],
    enabled:  !!userId,
    staleTime: Infinity, // onSnapshot handles freshness
  });

  const loadMore = useCallback(async () => {
    if (!userId || !lastVisible || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      const older = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      queryClient.setQueryData(
        ['transactions', userId],
        (prev: Transaction[] = []) => [...prev, ...older]
      );
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [userId, lastVisible, hasMore, loadingMore, queryClient]);

  return { transactions, loadingMore, hasMore, loadMore };
}