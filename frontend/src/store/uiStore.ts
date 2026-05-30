import { create } from 'zustand';

interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  activeTab: 'chat' | 'admin' | 'logs';
  
  // Actions
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: 'chat' | 'admin' | 'logs') => void;
}

export const useUIStore = create<UIState>((set) => {
  // Load initial theme, default to dark for premium SaaS feel
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  const initialTheme = savedTheme || 'dark';
  
  // Apply initial theme classes directly to standard HTML DOM
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  return {
    theme: initialTheme,
    sidebarOpen: true, // Default open on desktop
    activeTab: 'chat',
    
    toggleTheme: () => set((state) => {
      const nextTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', nextTheme);
      
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      return { theme: nextTheme };
    }),
    
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    
    setActiveTab: (activeTab) => set({ activeTab })
  };
});
