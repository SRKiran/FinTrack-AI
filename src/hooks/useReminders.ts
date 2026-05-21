import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Reminder, ReminderType } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore';

export function useReminders(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      queryClient.setQueryData(['reminders', userId], []);
      return;
    }
    const q = query(
      collection(db, 'reminders'),
      where('userId', '==', userId),
      where('isPaid', '==', false),
      orderBy('dueDate', 'asc')
    );
    return onSnapshot(q, (snap) => {
      queryClient.setQueryData(
        ['reminders', userId],
        snap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder))
      );
    });
  }, [userId, queryClient]);

  const { data: reminders = [] } = useQuery<Reminder[]>({
    queryKey: ['reminders', userId],
    queryFn:  () => [],
    enabled:  !!userId,
    staleTime: Infinity,
  });

  const { mutateAsync: toggleReminder } = useMutation({
    mutationFn: (id: string) => updateDoc(doc(db, 'reminders', id), { isPaid: true }),
    onError: (e, id) => handleFirestoreError(e, OperationType.UPDATE, `reminders/${id}`),
  });

  const { mutateAsync: addReminder } = useMutation({
    mutationFn: (data: { type: ReminderType; description: string; amount: number; dueDate: Date }) => {
      if (!userId) throw new Error('Not authenticated');
      return addDoc(collection(db, 'reminders'), {
        userId,
        type: data.type,
        description: data.description,
        amount: data.amount,
        dueDate: Timestamp.fromDate(data.dueDate),
        isPaid: false,
        createdAt: serverTimestamp(),
      });
    },
    onError: (e) => handleFirestoreError(e, OperationType.CREATE, 'reminders'),
  });

  const { mutateAsync: deleteReminder } = useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, 'reminders', id)),
    onError: (e, id) => handleFirestoreError(e, OperationType.DELETE, `reminders/${id}`),
  });

  return { reminders, toggleReminder, addReminder, deleteReminder };
}