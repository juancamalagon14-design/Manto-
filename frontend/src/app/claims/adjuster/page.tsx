'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AdjusterClaimConsole } from '@/components/claims/AdjusterClaimConsole';

export default function AdjusterPage() {
  return (
    <main className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/claims"
            className="text-xs font-semibold text-gray-500 hover:text-navy-900 transition-colors flex items-center gap-1"
          >
            ← Volver al portal de asegurados
          </Link>
          <span className="text-xs text-orange-cta font-semibold">
            Modo Auditor Clínico Activo
          </span>
        </div>

        <AdjusterClaimConsole />
      </div>
      <Footer />
    </main>
  );
}
