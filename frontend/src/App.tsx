import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // If session is unauthenticated, redirect to sign-in portal
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Route to the unified Shell container
  return <ChatPage />;
}

