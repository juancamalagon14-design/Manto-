'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';

/**
 * Hero institucional de la portada.
 *
 * No lleva cotizador: la portada cuenta quién es Manto. Cotizar vive en /mascotas.
 * Los indicadores van como texto, no como tarjetas con borde — la jerarquía la hace
 * la tipografía y el aire, no las cajas.
 */

const CIFRAS = [
  { valor: '60 seg', detalle: 'De la primera pregunta a tu póliza vigente' },
  { valor: 'Bre-B', detalle: 'Reembolsos liquidados a tu cuenta en segundos' },
  { valor: 'Ley 1801', detalle: 'Responsabilidad civil certificada de 50 SMLMV' },
];

export const Hero: React.FC = () => {
  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:px-6 md:pb-24 md:pt-20 lg:px-8">
        <div className="max-w-3xl space-y-7">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-navy-500">
            Seguros digitales · Colombia
          </p>

          <h1 className="text-3xl font-bold leading-[1.08] tracking-tight text-navy-900 sm:text-4xl lg:text-display">
            Cuidar a los tuyos no debería ser{' '}
            <span className="text-orange-brand">complicado</span>.
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-navy-500">
            Manto nace de una idea simple: un seguro se contrata para estar tranquilo, no para
            pelear con la letra menuda. Por eso construimos uno que se cotiza conversando, que
            explica en español lo que cubre, y que devuelve el dinero sin pedir carpetas.
          </p>

          <div className="flex flex-wrap items-center gap-4 sm:gap-5 pt-2">
            <Link
              href="/mascotas"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-cta px-7 py-3.5 text-base font-semibold text-white shadow-cta transition-all hover:bg-orange-hover active:scale-[0.98] min-h-[48px]"
            >
              Seguro para mascotas
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#como-funciona"
              className="inline-flex items-center py-2 text-base font-medium text-navy-900 underline-offset-4 transition-colors hover:text-orange-cta hover:underline min-h-[44px]"
            >
              Cómo funciona
            </Link>
          </div>

          {/* Acceso a Reembolsos en landing principal: diseño limpio Manto Sanctuary */}
          <div className="mt-10 pt-6 border-t border-line sm:mt-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-brand">
                    <Zap className="h-3.5 w-3.5" />
                    <span>Sué · Reembolsos inmediatos</span>
                  </span>
                  <span className="text-xs text-navy-400">·</span>
                  <span className="text-xs font-medium text-navy-500">¿Ya tienes una póliza activa?</span>
                </div>
                <p className="text-sm font-medium text-navy-800">
                  Devolvemos tu dinero en minutos vía Bre-B con solo subir la factura y la epicrisis veterinaria.
                </p>
              </div>
              <Link
                href="/claims"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-canvas-pure border border-line px-5 py-3 text-sm font-semibold text-navy-900 shadow-xs hover:border-orange-cta hover:text-orange-cta transition-all active:scale-[0.98] shrink-0 min-h-[44px]"
              >
                <span>Pedir reembolso veterinario</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Cifras en texto. Sin recuadros: separadas por línea fina y aire. */}
        <dl className="mt-16 grid gap-x-10 gap-y-8 border-t border-line pt-10 sm:grid-cols-3 md:mt-20">
          {CIFRAS.map((c) => (
            <div key={c.valor} className="space-y-1.5">
              <dt className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                {c.valor}
              </dt>
              <dd className="text-sm leading-relaxed text-navy-500">{c.detalle}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default Hero;
