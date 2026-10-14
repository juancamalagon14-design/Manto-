'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, ShieldCheck, ArrowRight, Clock, FileCheck2, Send } from 'lucide-react';

/**
 * SueSection - Lane de reembolsos veterinarios en la portada institucional.
 *
 * Narrativa cultural:
 * "Sue, nombrado por el dios Muisca, es la energía, la tecnología, la inmediatez y la luz
 * que resuelve la urgencia cuando más lo necesitas. Sue tiene una identidad colombiana,
 * fuerza ancestral y una misión clara: Devolverte la tranquilidad en minutos."
 *
 * Diseño limpio: tipografía elegante Manto Sanctuary, sin cajas innecesarias ni recuadros pesados.
 */
export const SueSection: React.FC = () => {
  return (
    <section id="siniestros" className="relative py-20 md:py-28 border-t border-line bg-canvas-pure">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Cabecera y Narrativa Cultural */}
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-3.5 py-1 text-xs font-semibold text-navy-700">
            <Zap className="h-3.5 w-3.5 text-orange-brand" />
            <span>Sué · Reembolsos inmediatos y transferencias Bre-B</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-display font-bold text-navy-900 tracking-tight leading-tight">
            Cuando la urgencia no da espera,{' '}
            <span className="text-orange-brand">el pago tampoco.</span>
          </h2>

          <p className="text-lg leading-relaxed text-navy-600 font-medium">
            Sue, nombrado por el dios Muisca, es la energía, la tecnología, la inmediatez y la luz que resuelve la urgencia cuando más lo necesitas. Sue tiene una identidad colombiana, fuerza ancestral y una misión clara: Devolverte la tranquilidad en minutos.
          </p>

          <p className="text-base leading-relaxed text-navy-500">
            Olvídate de formularios de diez páginas y semanas de espera. Con Sué subes la foto de la factura y la epicrisis veterinaria, el sistema audita el CUFE DIAN en segundos y dispersa directamente a tu cuenta bancaria o llave Bre-B.
          </p>

          {/* Botón claro requerido */}
          <div className="pt-2">
            <Link
              href="/claims"
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-orange-cta px-8 py-4 text-base font-semibold text-white shadow-cta transition-all hover:bg-orange-hover active:scale-[0.98] min-h-[48px]"
            >
              <span>Pedir reembolso veterinario</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Pilares en tipografía elegante, sin cajas innecesarias (estilo Manto Sanctuary) */}
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-line">
          <div className="space-y-2">
            <dt className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <Clock className="h-4 w-4 text-orange-brand shrink-0" />
              <span>STP en 3 minutos</span>
            </dt>
            <dd className="text-sm leading-relaxed text-navy-500">
              Aprobación autónoma inmediata para montos de hasta $200.000 COP. Auditoría pericial médica humana en menos de 24 horas para montos mayores.
            </dd>
          </div>

          <div className="space-y-2">
            <dt className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <Send className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Giro directo por Bre-B</span>
            </dt>
            <dd className="text-sm leading-relaxed text-navy-500">
              Dispersión interoperable sin intermediarios a Bancolombia, Nequi, DaviPlata o cualquier cuenta con el respaldo del Banco de la República.
            </dd>
          </div>

          <div className="space-y-2">
            <dt className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <FileCheck2 className="h-4 w-4 text-orange-brand shrink-0" />
              <span>Auditoría DIAN CUFE</span>
            </dt>
            <dd className="text-sm leading-relaxed text-navy-500">
              Validación electrónica instantánea de factura legal y revisión automática del período de carencia contra la historia clínica veterinaria.
            </dd>
          </div>
        </dl>

        {/* Nota legal de confianza */}
        <div className="flex items-center gap-3 pt-2 text-xs text-navy-400">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            Trámite regulado conforme a la Ley 1581 de 2012 y el régimen asegurador colombiano. Cero trámites físicos.
          </span>
        </div>
      </div>
    </section>
  );
};

export default SueSection;
