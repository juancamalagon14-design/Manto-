'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ClaimsStepper } from '@/components/claims/ClaimsStepper';

function ClaimsPageContent() {
  const searchParams = useSearchParams();
  const policyId = searchParams.get('policyId') || 'pol-active-default-001';
  const petName = searchParams.get('petName') || 'tu mascota';
  const policyNumber = searchParams.get('policyNumber') || 'MTO-PET-2026-ACTIVA';

  return (
    <main className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-brand/15 text-orange-cta border border-orange-brand/30">
            Reembolsos Ágiles · Fast-Track & Bre-B
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            Radicación y Triage de Siniestros
          </h1>
          <p className="text-sm text-gray-600 max-w-lg mx-auto">
            Sube la factura veterinaria de {petName}. Nuestro motor de IA procesará los datos al instante para desembolsar tu reembolso sin papeleos.
          </p>
        </div>

        <ClaimsStepper
          policyId={policyId}
          petName={petName}
          policyNumber={policyNumber}
        />
      </div>
      <Footer />
    </main>
  );
}

export default function ClaimsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-cta" />
      </div>
    }>
      <ClaimsPageContent />
    </Suspense>
  );
}
