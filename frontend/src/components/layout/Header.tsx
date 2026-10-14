'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

interface HeaderProps {
  /** Se pasa cuando el inicio de sesión esté disponible. Mientras no exista, el enlace se marca como próximo. */
  onSignIn?: () => void;
}

/** Líneas de negocio. Solo Mascotas está operativa. */
const RAMOS = [
  { label: 'Mascotas', href: '/mascotas', available: true },
  { label: 'Hogar', href: undefined, available: false },
  { label: 'Vida', href: undefined, available: false },
] as const;

const SoonBadge = () => (
  <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-navy-900">
    Próximamente
  </span>
);

export const Header: React.FC<HeaderProps> = ({ onSignIn }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-canvas-pure">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid h-20 grid-cols-[auto_1fr] items-center gap-4 sm:h-24 md:grid-cols-[1fr_auto_1fr]">
          {/* Izquierda: líneas de producto */}
          <nav className="hidden items-center gap-5 md:flex">
            {RAMOS.map((ramo) =>
              ramo.available ? (
                <Link
                  key={ramo.label}
                  href={ramo.href}
                  className="relative text-sm font-medium text-navy-900 transition-colors hover:text-orange-cta after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-orange-cta"
                >
                  {ramo.label}
                </Link>
              ) : (
                <span
                  key={ramo.label}
                  className="flex items-center gap-1.5 text-sm font-medium text-navy-400"
                  title={`Seguro de ${ramo.label.toLowerCase()} — aún no disponible`}
                >
                  {ramo.label}
                  <SoonBadge />
                </span>
              ),
            )}
          </nav>

          {/* Centro: logotipo oficial Manto */}
          <Link
            href="/"
            className="order-first inline-block justify-self-start py-2 md:order-none md:justify-self-center"
            title="Manto · Seguros Digitales"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/manto-logo-color.png"
              alt="manto · seguros digitales"
              className="h-10 w-auto object-contain sm:h-12 md:h-14"
            />
          </Link>

          {/* Derecha: inicio de sesión y botón menú móvil */}
          <div className="flex items-center justify-end gap-2.5 sm:gap-3">
            {onSignIn ? (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center justify-center rounded-xl bg-orange-cta px-4 sm:px-5 py-2.5 text-sm font-semibold text-white shadow-cta transition-all hover:bg-orange-hover active:scale-[0.98] min-h-[44px]"
              >
                Iniciar sesión
              </button>
            ) : (
              <span
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-navy-400"
                title="El inicio de sesión estará disponible pronto"
              >
                Iniciar sesión
                <SoonBadge />
              </span>
            )}

            {/* Botón de apertura de menú móvil accesible (>= 44x44px) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
              aria-expanded={mobileMenuOpen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-canvas-pure text-navy-900 transition-colors hover:bg-canvas hover:text-orange-cta md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menú desplegable móvil */}
      {mobileMenuOpen && (
        <div className="border-t border-line bg-canvas-pure px-4 py-5 shadow-lg md:hidden animate-fade-in">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400 px-2 pb-1">
                Líneas de producto
              </p>
              {RAMOS.map((ramo) =>
                ramo.available ? (
                  <Link
                    key={ramo.label}
                    href={ramo.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-navy-900 hover:bg-canvas transition-colors min-h-[44px]"
                  >
                    <span>{ramo.label}</span>
                    <span className="text-xs text-orange-brand font-semibold">Disponible</span>
                  </Link>
                ) : (
                  <div
                    key={ramo.label}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-navy-400 min-h-[44px]"
                  >
                    <span>{ramo.label}</span>
                    <SoonBadge />
                  </div>
                ),
              )}
            </div>

            <div className="border-t border-line pt-3 flex items-center justify-between px-2 text-sm text-navy-400 min-h-[44px]">
              <span>Iniciar sesión</span>
              <SoonBadge />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
