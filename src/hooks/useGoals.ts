import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SavingsGoal } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore';

export function useGoals(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      queryClient.setQueryData(['goals', userId], []);
      return;
    }
    const q = query(collection(db, 'goals'), where('userId', '==', userId));
    return onSnapshot(q, (snap) => {
      queryClient.setQueryData(
        ['goals', userId],
        snap.docs.map(d => ({ id: d.id, ...d.data() } as SavingsGoal))
      );
    });
  }, [userId, queryClient]);

  const { data: goals = [] } = useQuery<SavingsGoal[]>({
    queryKey: ['goals', userId],
    queryFn:  () => [],
    enabled:  !!userId,
    staleTime: Infinity,
  });

  const { mutateAsync: addGoal } = useMutation({
    mutationFn: (data: { name: string; targetAmount: number; currentAmount: number; deadline: Date }) => {
      if (!userId) throw new Error('Not authenticated');
      return addDoc(collection(db, 'goals'), {
        userId,
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount,
        deadline: Timestamp.fromDate(data.deadline),
        createdAt: serverTimestamp(),
      });
    },
    onError: (e) => handleFirestoreError(e, OperationType.CREATE, 'goals'),
  });

  const { mutateAsync: updateGoalProgress } = useMutation({
    mutationFn: ({ id, currentAmount }: { id: string; currentAmount: number }) =>
      updateDoc(doc(db, 'goals', id), { currentAmount }),
    onError: (e, { id }) => handleFirestoreError(e, OperationType.UPDATE, `goals/${id}`),
  });

  const { mutateAsync: deleteGoal } = useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, 'goals', id)),
    onError: (e, id) => handleFirestoreError(e, OperationType.DELETE, `goals/${id}`),
  });

  return { goals, addGoal, updateGoalProgress, deleteGoal };
}
