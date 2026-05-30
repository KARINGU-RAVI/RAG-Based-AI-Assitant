import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const activeTab = useUIStore((state) => state.activeTab);

  // If session is unauthenticated, redirect to sign-in portal
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Active tab routing
  switch (activeTab) {
    case 'chat':
      return <ChatPage />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <ChatPage />;
  }
}
