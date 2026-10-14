'use client';

import React from 'react';

/**
 * Logotipo de Manto.
 *
 * El archivo se usa TAL CUAL desde `public/brand/`. Nunca se redibuja en SVG,
 * ni se reconstruye con gradientes, ni se sustituye por un ícono equivalente:
 * una aproximación dibujada a mano no es el logotipo de la marca.
 *
 * Variantes disponibles en disco:
 *   manto-logo-color.png  lockup a color, para fondos claros
 *   manto-logo-navy.png   lockup monocromo navy
 */

type LogoVariant = 'color' | 'navy';
type LogoSize = 'sm' | 'md' | 'lg';

interface MantoLogoProps {
  className?: string;
  size?: LogoSize;
  variant?: LogoVariant;
  /** Texto alternativo. Cambiar solo si el logotipo cumple otra función semántica. */
  alt?: string;
}

const SIZE_CLASS: Record<LogoSize, string> = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-16',
};

const SOURCE: Record<LogoVariant, string> = {
  color: '/brand/manto-logo-color.png',
  navy: '/brand/manto-logo-navy.png',
};

export const MantoLogo: React.FC<MantoLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'color',
  alt = 'manto · seguros digitales',
}) => {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={SOURCE[variant]}
      alt={alt}
      className={`${SIZE_CLASS[size]} w-auto object-contain ${className}`}
    />
  );
};

export default MantoLogo;
