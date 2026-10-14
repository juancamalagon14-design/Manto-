'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Cómo funciona Manto — portada institucional.
 *
 * Secuencia real de tres pasos, numerada porque el orden importa.
 * Sin tarjetas: la estructura la dan el número, la línea divisoria y el espacio.
 */

interface Paso {
  n: string;
  titulo: string;
  texto: string;
  link?: {
    label: string;
    href: string;
  };
}

const PASOS: Paso[] = [
  {
    n: '01',
    titulo: 'Conversas',
    texto:
      'Nada de formularios de veinte campos. Le cuentas a Nuquí cómo es tu mascota —o le mandas una foto y la reconoce— y con eso basta.',
  },
  {
    n: '02',
    titulo: 'Ves tu precio',
    texto:
      'La cuota se calcula para tu mascota concreta: su raza, su edad, dónde vive. No hay planes bronce, plata y oro; hay una póliza y es la suya.',
  },
  {
    n: '03',
    titulo: 'Reclamas por chat',
    texto:
      'Cuando pase algo, le escribes a Sué con la factura del veterinario. El reembolso llega a tu cuenta por Bre-B, sin formatos ni ventanillas.',
    link: {
      label: 'Pedir un reembolso con Sué ⚡',
      href: '/claims',
    },
  },
];

export const ComoFunciona: React.FC = () => {
  return (
    <section id="como-funciona" className="border-t border-line bg-canvas-pure">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="max-w-2xl space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Tres pasos, y ninguno tiene letra menuda
          </h2>
          <p className="text-base leading-relaxed text-navy-500">
            Diseñamos Manto al revés de como se diseñan los seguros: primero preguntamos qué
            necesita entender una persona, y después armamos el producto alrededor de eso.
          </p>
        </div>

        <div className="mt-14 space-y-0">
          {PASOS.map((paso, i) => (
            <div
              key={paso.n}
              className={`grid gap-x-8 gap-y-3 py-9 sm:grid-cols-[auto_1fr] ${
                i > 0 ? 'border-t border-line' : ''
              }`}
            >
              <span className="text-sm font-semibold tabular-nums text-navy-400 sm:pt-1">
                {paso.n}
              </span>
              <div className="max-w-2xl space-y-2">
                <h3 className="text-lg font-semibold text-navy-900">{paso.titulo}</h3>
                <p className="text-base leading-relaxed text-navy-500">{paso.texto}</p>
                {paso.link && (
                  <div className="pt-2">
                    <Link
                      href={paso.link.href}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-brand transition-colors hover:text-orange-hover hover:underline min-h-[44px]"
                    >
                      <span>{paso.link.label}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ComoFunciona;
