'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import NuquiAssistant from '@/components/nuqui/NuquiAssistant';

/**
 * El cotizador, a pantalla completa.
 *
 * Sin Header ni Footer: aquí la persona está en una conversación y todo lo demás
 * es ruido. La única salida visible es volver a /mascotas.
 */
export default function CotizarPage() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas text-navy-900">
      <div className="sticky top-0 z-40 border-b border-line bg-canvas">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4 sm:px-6">
          <Link
            href="/mascotas"
            className="inline-flex items-center gap-2 text-sm font-medium text-navy-500 transition-colors hover:text-navy-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <Link href="/" className="ml-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/manto-logo-color.png"
              alt="manto · seguros digitales"
              className="h-9 w-auto object-contain sm:h-10"
            />
          </Link>
        </div>
      </div>

      <NuquiAssistant />
    </main>
  );
}
