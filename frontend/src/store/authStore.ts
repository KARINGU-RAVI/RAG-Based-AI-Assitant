import { create } from 'zustand';

interface AuthState {
  token: string | null;
  role: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  
  // Actions
  login: (token: string, role: string, username: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Try to load initial session from localStorage
  const savedToken = localStorage.getItem('auth_token');
  const savedRole = localStorage.getItem('auth_role');
  const savedUsername = localStorage.getItem('auth_username');
  
  return {
    token: savedToken,
    role: savedRole,
    username: savedUsername,
    isAuthenticated: !!savedToken,
    isAdmin: savedRole === 'admin',
    
    login: (token: string, role: string, username: string) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_role', role);
      localStorage.setItem('auth_username', username);
      set({
        token,
        role,
        username,
        isAuthenticated: true,
        isAdmin: role === 'admin'
      });
    },
    
    logout: () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_role');
      localStorage.removeItem('auth_username');
      set({
        token: null,
        role: null,
        username: null,
        isAuthenticated: false,
        isAdmin: false
      });
    }
  };
});
