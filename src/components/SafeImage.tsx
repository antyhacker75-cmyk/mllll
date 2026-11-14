import { useState } from 'react';
import { Shield } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackText,
  size = 'md',
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  const initials = (fallbackText || alt || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  if (!src || failed) {
    const textSize =
      size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-base' : 'text-xs';
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-slate-800/90 border border-slate-700/70 text-amber-300 font-display font-semibold select-none shrink-0 ${textSize} ${className}`}
      >
        {initials || <Shield className="w-4 h-4 text-slate-400" />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover shrink-0 bg-slate-800 ${className}`}
      loading="lazy"
    />
  );
}
