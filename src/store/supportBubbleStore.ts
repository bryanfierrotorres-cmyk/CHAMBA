import { create } from 'zustand';

interface SupportBubbleState {
  hiddenByScroll: boolean;
  setHiddenByScroll: (hidden: boolean) => void;
  showBubble: () => void;
}

export const useSupportBubbleStore = create<SupportBubbleState>((set) => ({
  hiddenByScroll: false,
  setHiddenByScroll: (hidden) => set({ hiddenByScroll: hidden }),
  showBubble: () => set({ hiddenByScroll: false }),
}));
