import { create } from 'zustand';
import { UserProfile } from '../types';

interface ProfileState {
  profile: UserProfile | null;
  setProfile: (p: UserProfile | null) => void;
  patchProfile: (patch: Partial<UserProfile>) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,

  setProfile: (profile) => set({ profile }),

  patchProfile: (patch) =>
    set((s) => ({ profile: s.profile ? { ...s.profile, ...patch } : null })),
}));
