import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Logo } from './Logo';
import { Package, Bike, Phone, User, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

type Mode = 'signin' | 'signup';
type Role = 'client' | 'driver';

const iconPad = { paddingLeft: '3rem' };

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [role, setRole] = useState<Role>('client');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles5')
            .insert({ id: data.user.id, full_name: fullName, phone, role });
          if (profileError) throw profileError;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue';
      if (msg.includes('Invalid login')) {
        setError('Email ou mot de passe incorrect');
      } else if (msg.includes('already registered')) {
        setError('Cet email est déjà utilisé');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const roleBtn = (r: Role, label: string, Icon: typeof Package) => (
    <button
      type="button"
      onClick={() => setRole(r)}
      className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${
        role === r ? 'border-[#FC3F1D] bg-[#FC3F1D]/10' : 'border-gray-200 bg-white'
      }`}
    >
      <Icon size={24} className={role === r ? 'text-[#FC3F1D]' : 'text-gray-400'} />
      <span className={`text-sm font-semibold ${role === r ? 'text-[#FC3F1D]' : 'text-gray-500'}`}>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* En-tête rouge */}
      <div className="bg-[#FC3F1D] px-6 pt-14 pb-10 rounded-b-[2.5rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-8 -translate-x-8" />
        <div className="relative flex items-center gap-3">
          <Logo size={56} variant="white" />
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">MABO</h1>
            <p className="text-white/80 text-sm font-medium">Livraison de colis au Sénégal</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pt-8 pb-10 max-w-md mx-auto w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {mode === 'signin' ? 'Connexion' : 'Créer un compte'}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {mode === 'signin'
            ? 'Connectez-vous pour envoyer ou livrer des colis'
            : 'Rejoignez MABO en quelques secondes'}
        </p>

        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {roleBtn('client', 'Client', Package)}
            {roleBtn('driver', 'Livreur', Bike)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div className="relative">
                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="mab-input" style={iconPad} type="text" placeholder="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="relative">
                <Phone size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="mab-input" style={iconPad} type="tel" placeholder="Numéro de téléphone (ex: 77 123 45 67)" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </>
          )}

          <div className="relative">
            <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="mab-input" style={iconPad} type="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="relative">
            <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="mab-input" style={iconPad} type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && (
            <div className="mab-animate-shake bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <button type="submit" disabled={loading} className="mab-btn-primary w-full flex items-center justify-center gap-2">
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
            className="text-sm text-gray-600 font-medium"
          >
            {mode === 'signin' ? "Vous n'avez pas de compte ? " : 'Vous avez déjà un compte ? '}
            <span className="text-[#FC3F1D] font-semibold underline">
              {mode === 'signin' ? 'Inscrivez-vous' : 'Connectez-vous'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}