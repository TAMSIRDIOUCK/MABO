import { useAuth } from '../lib/auth';
import { Loader2, LogOut } from 'lucide-react';
import { AuthScreen } from './AuthScreen';
import { ClientView } from './ClientView';
import { DriverView } from './DriverView';
import { Logo } from './Logo';

export function AppContent() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <Logo size={64} />
        <Loader2 size={24} className="animate-spin text-[#FC3F1D]" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4 px-6 text-center">
        <Logo size={64} />
        <p className="text-gray-600 text-sm">Profil introuvable. Veuillez vous reconnecter.</p>
        <button
          onClick={signOut}
          className="mt-2 inline-flex items-center gap-2 bg-[#FC3F1D] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e03213] transition-colors"
        >
          <LogOut size={16} />
          Se déconnecter
        </button>
      </div>
    );
  }

  if (profile.role === 'driver') {
    return <DriverView />;
  }

  return <ClientView />;
}