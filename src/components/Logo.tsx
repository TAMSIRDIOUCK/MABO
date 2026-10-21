import { Package } from 'lucide-react';

/** variant="red" : fond rouge, icône blanche  |  variant="white" : fond blanc, icône rouge (pour les en-têtes rouges) */
export function Logo({
  size = 40,
  className = '',
  variant = 'red',
}: {
  size?: number;
  className?: string;
  variant?: 'red' | 'white';
}) {
  const white = variant === 'white';
  return (
    <div
      className={`flex items-center justify-center rounded-2xl ${white ? 'bg-white' : 'bg-[#FC3F1D]'} ${className}`}
      style={{ width: size, height: size }}
    >
      <Package size={size * 0.55} className={white ? 'text-[#FC3F1D]' : 'text-white'} strokeWidth={2.5} />
    </div>
  );
}

export function LogoFull({ size = 40, onRed = false }: { size?: number; onRed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={size} variant={onRed ? 'white' : 'red'} />
      <span className={`text-2xl font-extrabold tracking-tight ${onRed ? 'text-white' : 'text-black'}`}>MABO</span>
    </div>
  );
}