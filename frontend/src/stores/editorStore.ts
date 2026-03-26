import { create } from 'zustand';

interface EditorState {
  code: string;
  currentChallengeId: string | null;
  language: string;
  setCode: (code: string) => void;
  setChallenge: (id: string | null, starterCode: string, language: string) => void;
  resetCode: (starterCode: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  code: '',
  currentChallengeId: null,
  language: 'python',
  setCode: (code) => set({ code }),
  setChallenge: (id, starterCode, language) =>
    set({ currentChallengeId: id, code: starterCode || '', language }),
  resetCode: (starterCode) => set({ code: starterCode || '' }),
}));
