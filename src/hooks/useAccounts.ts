import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Account } from '../types';

export function useAccounts(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      queryClient.setQueryData(['accounts', userId], []);
      return;
    }
    const q = query(collection(db, 'accounts'), where('userId', '==', userId));
    return onSnapshot(q, (snap) => {
      queryClient.setQueryData(
        ['accounts', userId],
        snap.docs.map(d => ({ id: d.id, ...d.data() } as Account))
      );
    });
  }, [userId, queryClient]);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts', userId],
    queryFn:  () => [],
    enabled:  !!userId,
    staleTime: Infinity,
  });

  const { mutateAsync: addAccount } = useMutation({
    mutationFn: (data: { name: string; type: 'asset' | 'liability'; identifier?: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return addDoc(collection(db, 'accounts'), {
        userId,
        name: data.name,
        type: data.type,
        ...(data.identifier ? { identifier: data.identifier } : {}),
        createdAt: serverTimestamp(),
      });
    },
  });

  const { mutateAsync: deleteAccount } = useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, 'accounts', id)),
  });

  return { accounts, addAccount, deleteAccount };
}
