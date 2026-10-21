import { AuthProvider } from '@/lib/auth';
import { AppContent } from '@/components/AppContent';

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
