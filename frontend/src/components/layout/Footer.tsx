'use client';

import React from 'react';
import Link from 'next/link';
import MantoLogo from './MantoLogo';
import { ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-16 text-xs text-slate-500">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Marca */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/manto-logo-color.png"
                alt="manto . seguros digitales"
                className="h-10 w-auto object-contain"
              />
            </Link>
            <p className="text-xs text-slate-600 leading-relaxed">
              Plataforma insurtech digital multi-ramo diseñada para proteger mascotas en Colombia
              con tecnología conversacional y liquidaciones inmediatas.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Bogotá • Medellín • Cali</span>
            </div>
          </div>

          {/* Col 2: Agentes IA */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Ecosistema de IAs
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/mascotas"
                  className="inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-orange-cta py-0.5"
                >
                  <span className="font-semibold text-navy-900">Nuquí 🐾:</span> Cotización y visión en vivo
                </Link>
              </li>
              <li>
                <Link
                  href="/claims"
                  className="inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-orange-cta py-0.5"
                >
                  <span className="font-semibold text-navy-900">Sué ⚡ (Reembolsos):</span> Reembolsos y pagos Bre-B
                </Link>
              </li>
              <li>
                <Link
                  href="/mascotas#coberturas"
                  className="inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-orange-cta py-0.5"
                >
                  Tarificación Determinista
                </Link>
              </li>
              <li>
                <Link
                  href="/mascotas#ley-1801"
                  className="inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-orange-cta py-0.5"
                >
                  Validador Ley 1801 (RCE)
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Marco Regulatorio */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Cumplimiento Legal
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>• Ley 527 de 1999 (Validez de Carátula Digital)</li>
              <li>• Ley 1581 de 2012 (Habeas Data Colombia)</li>
              <li>• Ley 1801 de 2016 (Régimen de RCE Canino)</li>
              <li>• Sistema de Pagos Inmediatos Bre-B</li>
            </ul>
          </div>

          {/* Col 4: Asistencia */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Atención y Urgencias 24/7
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Línea prioritaria veterinaria disponible las 24 horas del día, los 365 días del año.
            </p>
            <div className="pt-1 text-xs font-semibold text-navy-900 space-y-1">
              <div>contacto@manto.com</div>
              <div>Tel: 312-872-3585</div>
            </div>
          </div>
        </div>

        {/* Barra de Derechos al Pie */}
        <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Manto Technologies S.A.S. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-navy-900 cursor-pointer">Términos del Servicio</span>
            <span>•</span>
            <span className="hover:text-navy-900 cursor-pointer">Política de Privacidad</span>
            <span>•</span>
            <span className="hover:text-navy-900 cursor-pointer">Superintendencia Financiera</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
