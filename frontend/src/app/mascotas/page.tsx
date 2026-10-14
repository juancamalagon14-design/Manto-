'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

/**
 * Landing del ramo Mascotas.
 *
 * Su único trabajo es llevar a /mascotas/cotizar. El cuadro de amparos va como
 * tabla —que es la convención de una póliza— y no como tarjetas.
 */

const AMPAROS = [
  {
    nombre: 'Urgencias y hospitalización por accidente',
    detalle: 'Atención vital, estabilización, suturas, fracturas y cirugía tras un accidente.',
    suma: '$3.500.000',
    aporte: '15%',
    activacion: 'Inmediata',
  },
  {
    nombre: 'Consultas médicas de urgencia',
    detalle: 'Hasta 3 consultas al año por evento súbito, en la red de clínicas aliadas.',
    suma: '$450.000',
    aporte: '15%',
    activacion: '2 días',
  },
  {
    nombre: 'Exámenes de diagnóstico',
    detalle: 'Radiografías, ecografías y cuadros hemáticos requeridos tras un accidente.',
    suma: '$800.000',
    aporte: '15%',
    activacion: 'Inmediata',
  },
];

const OPCIONALES = [
  'Enfermedades comunes e infecciosas',
  'Medicamentos recetados ambulatorios',
  'Telemedicina veterinaria 24/7',
  'Asistencia exequial y cremación',
  'Guardería si el titular es hospitalizado',
  'Responsabilidad civil Ley 1801',
];

export default function MascotasPage() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas text-navy-900">
      <Header />

      {/* Apertura del ramo */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-14 pt-14 sm:px-6 md:pb-20 md:pt-20 lg:px-8">
        <div className="max-w-3xl space-y-7">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-navy-500">
            Perros y gatos
          </p>
          <h1 className="text-3xl font-bold leading-[1.08] tracking-tight text-navy-900 sm:text-4xl lg:text-display">
            Una póliza hecha para <span className="text-orange-brand">tu</span> mascota.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-navy-500">
            Su raza, su edad y dónde vive cambian lo que necesita y lo que cuesta. Por eso no
            vendemos paquetes: calculamos su cuota y tú decides qué le agregas.
          </p>
        </div>
      </section>

      {/* CTA central: el punto de esta página */}
      <section className="border-y border-line bg-canvas-pure">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 md:py-20 lg:px-8">
          <h2 className="max-w-xl text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Averigua cuánto cuesta en dos minutos
          </h2>
          <p className="max-w-lg text-base leading-relaxed text-navy-500">
            Conversas con Nuquí o le mandas una foto. No pedimos datos de pago para darte el precio.
          </p>
          <Link
            href="/mascotas/cotizar"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-orange-cta px-8 py-4 text-base font-semibold text-white shadow-cta transition-all hover:bg-orange-hover active:scale-[0.98]"
          >
            Cotizar ahora
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Cuadro de amparos */}
      <section id="coberturas" className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Lo que toda póliza incluye
          </h2>
          <p className="text-base leading-relaxed text-navy-500">
            Igual para cualquier raza, edad o ciudad. Lo que cambia entre una mascota y otra es la
            cuota, nunca la cobertura.
          </p>
        </div>

        {/* Tabla en pantallas anchas.
            En un teléfono la tabla tenía `min-w-[640px]` dentro de un
            `overflow-x-auto`: las tres columnas de cifras quedaban fuera de
            pantalla y había que arrastrar un contenedor interno para verlas, así
            que en la práctica las sumas aseguradas no se veían. Debajo va la
            misma información apilada. */}
        <div className="mt-10 hidden sm:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-wider text-navy-500">
                  Amparo
                </th>
                <th className="py-3 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-navy-500">
                  Suma asegurada
                </th>
                <th className="py-3 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-navy-500">
                  Tu aporte
                </th>
                <th className="py-3 text-right text-xs font-semibold uppercase tracking-wider text-navy-500">
                  Activación
                </th>
              </tr>
            </thead>
            <tbody>
              {AMPAROS.map((a) => (
                <tr key={a.nombre} className="border-b border-line-soft align-top">
                  <td className="max-w-md py-5 pr-6">
                    <span className="block font-semibold text-navy-900">{a.nombre}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-navy-500">
                      {a.detalle}
                    </span>
                  </td>
                  <td className="py-5 pr-6 text-right tabular-nums text-navy-500">{a.suma}</td>
                  <td className="py-5 pr-6 text-right tabular-nums text-navy-500">{a.aporte}</td>
                  <td className="py-5 text-right text-navy-500">{a.activacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* La misma información, apilada, para teléfono. */}
        <div className="mt-8 sm:hidden">
          {AMPAROS.map((a) => (
            <div key={a.nombre} className="border-b border-line-soft py-5 last:border-0">
              <p className="font-semibold text-navy-900">{a.nombre}</p>
              <p className="mt-1 text-sm leading-relaxed text-navy-500">{a.detalle}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-navy-500">Suma asegurada</dt>
                  <dd className="tabular-nums font-medium text-navy-900">{a.suma}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-navy-500">Tu aporte</dt>
                  <dd className="tabular-nums font-medium text-navy-900">{a.aporte}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-navy-500">Activación</dt>
                  <dd className="font-medium text-navy-900">{a.activacion}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy-500">
          Sumas aseguradas por vigencia anual. Tu aporte se calcula sobre el valor del servicio, ya
          con la tarifa negociada de la red de clínicas aliadas.
        </p>

        {/* Opcionales, como lista de texto */}
        <div id="ley-1801" className="mt-14 border-t border-line pt-10">
          <h3 className="text-lg font-semibold text-navy-900">Y lo que puedes agregarle</h3>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-navy-500">
            Al final de la cotización, sobre la cuota ya calculada. Se quitan cuando quieras.
          </p>
          <ul className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2">
            {OPCIONALES.map((o) => (
              <li key={o} className="flex gap-3 text-base text-navy-500">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-navy-300" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Footer />
    </main>
  );
}
