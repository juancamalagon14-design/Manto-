'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Sparkles, Zap, Phone, ArrowRight, ShieldCheck } from 'lucide-react';

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // En la página de cotización a pantalla completa (/mascotas/cotizar), Nuquí ya ocupa la pantalla completa.
  if (pathname === '/mascotas/cotizar') {
    return null;
  }

  return (
    <aside aria-label="Asistente Manto" className="fixed bottom-6 right-6 z-50">
      {/* Ventana flotante de Chat / Asistente */}
      {isOpen && (
        <div className="mb-3 w-[340px] sm:w-[380px] rounded-3xl border border-line bg-canvas-pure shadow-2xl overflow-hidden animate-slide-up transition-all">
          {/* Cabecera del Widget */}
          <div className="bg-navy-900 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-cta text-white shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Manto Asistencia</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Nuquí 🐾 y Sué ⚡ en línea</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Cerrar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Cuerpo y Opciones Ágiles */}
          <div className="p-4 space-y-3 bg-canvas/40">
            <p className="text-xs text-navy-600 leading-relaxed">
              ¡Hola! ¿En qué te acompañamos hoy? Elige una opción o comunícate con nosotros:
            </p>

            <div className="space-y-2">
              <Link
                href="/mascotas/cotizar"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-white border border-line shadow-xs hover:border-orange-cta hover:bg-orange-subtle/30 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🐾</span>
                  <div>
                    <span className="text-xs font-bold text-navy-900 group-hover:text-orange-cta block">
                      Cotizar póliza para tu peludo
                    </span>
                    <span className="text-[11px] text-navy-500 block">
                      Con Nuquí en 2 minutos sin datos bancarios
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-navy-400 group-hover:text-orange-cta transition-colors" />
              </Link>

              <Link
                href="/claims"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-white border border-line shadow-xs hover:border-orange-cta hover:bg-orange-subtle/30 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-subtle text-orange-brand">
                    <Zap className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-navy-900 group-hover:text-orange-cta block">
                      Pedir reembolso veterinario
                    </span>
                    <span className="text-[11px] text-navy-500 block">
                      Con Sué y giro directo por Bre-B
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-navy-400 group-hover:text-orange-cta transition-colors" />
              </Link>

              <a
                href="https://wa.me/573128723585?text=Hola%20Manto,%20necesito%20asesor%C3%ADa%20personalizada"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-2xl bg-white border border-line shadow-xs hover:border-emerald-500 hover:bg-emerald-50/40 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Phone className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-navy-900 group-hover:text-emerald-700 block">
                      Línea y WhatsApp: 312-872-3585
                    </span>
                    <span className="text-[11px] text-navy-500 block">
                      Atención prioritaria y soporte 24/7
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-navy-400 group-hover:text-emerald-700 transition-colors" />
              </a>
            </div>

            <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] text-navy-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>contacto@manto.com · Ley 1581 de 2012</span>
            </div>
          </div>
        </div>
      )}

      {/* Botón Flotante Persistente */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-orange-cta text-white shadow-cta hover:bg-orange-hover hover:scale-105 active:scale-95 transition-all focus:outline-none"
        aria-label="Abrir asistente de chat Manto"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
            </span>
          </>
        )}
      </button>
    </aside>
  );
};

export default ChatWidget;
