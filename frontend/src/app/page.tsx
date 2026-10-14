'use client';

import React from 'react';
import Header from '@/components/layout/Header';
import Hero from '@/components/layout/Hero';
import ComoFunciona from '@/components/layout/ComoFunciona';
import SueSection from '@/components/layout/SueSection';
import Footer from '@/components/layout/Footer';

/**
 * Portada institucional.
 *
 * Aquí se cuenta quién es Manto. El cotizador NO vive en esta página:
 * vive en /mascotas/cotizar, y se llega por la landing del ramo.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas text-navy-900">
      <Header />
      <Hero />
      <ComoFunciona />
      <SueSection />
      <Footer />
    </main>
  );
}
