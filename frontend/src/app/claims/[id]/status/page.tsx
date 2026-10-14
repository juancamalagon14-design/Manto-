'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LiveClaimTracker } from '@/components/claims/LiveClaimTracker';

interface ClaimStatusPageProps {
  params: {
    id: string;
  };
}

export default function ClaimStatusPage({ params }: ClaimStatusPageProps) {
  const { id } = params;

  return (
    <main className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/claims"
            className="text-xs font-semibold text-gray-500 hover:text-navy-900 transition-colors flex items-center gap-1"
          >
            ← Volver a radicación
          </Link>
          <span className="text-xs text-gray-400 font-mono">
            ID: {id.slice(0, 8)}...
          </span>
        </div>

        <LiveClaimTracker claimId={id} />
      </div>
      <Footer />
    </main>
  );
}
