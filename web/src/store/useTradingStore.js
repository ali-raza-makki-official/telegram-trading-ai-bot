import { create } from 'zustand';

export const useTradingStore = create((set, get) => ({
  activeTab: 'terminal', // 'terminal' | 'strategy'
  selectedTimeframe: '15m',
  account: { balance: 462.14, equity: 462.14, pnl: 0 },
  status: null,
  positions: [],
  commandPaletteOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),
  setAccount: (account) => set({ account }),
  setStatus: (status) => set({ status }),
  setPositions: (positions) => set({ positions }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
}));
