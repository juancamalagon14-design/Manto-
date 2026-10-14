'use client';

import React, { useState } from 'react';
import { X, Lock, ShieldCheck, CreditCard, Landmark, Clock, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCop } from '@/lib/utils';
import { PolicyCustomer, CheckoutResult } from '@/types/policy';

export interface PetBillingItem {
  name: string;
  amountCop: number;
}

interface CheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  totalAmountCop: number;
  billingFrequency: 'MONTHLY' | 'ANNUAL';
  petName: string;
  petBreakdown?: PetBillingItem[];
}

export const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({
  isOpen,
  onClose,
  quoteId,
  totalAmountCop,
  billingFrequency,
  petName,
  petBreakdown,
}) => {
  const [customer, setCustomer] = useState<PolicyCustomer>({
    fullName: '',
    email: '',
    phone: '',
    nationalId: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'PSE' | 'CREDIT_CARD'>('PSE');
  const [habeasDataAccepted, setHabeasDataAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habeasDataAccepted) {
      setErrorMessage('Debes autorizar el tratamiento de datos personales para continuar.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await api.checkoutPolicy({
        quoteId,
        customer,
        paymentMethodType: paymentMethod,
        billingFrequency,
        autoRenewalEnabled: true,
      });

      setCheckoutResult(result);
    } catch (err: any) {
      console.error('Error durante checkout:', err);
      setErrorMessage(err.message || 'Ocurrió un error al procesar la emisión de la póliza.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="relative h-full w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
        {/* Cabecera del Drawer */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-subtle text-orange-brand">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-navy-900">Checkout Seguro</h3>
                <p className="text-xs text-navy-500">Datos del titular para {petName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {checkoutResult ? (
            /* La cotización quedó vinculada y la póliza espera el pago.
               NO está emitida: no hay número de contrato, ni vigencia, ni
               certificado hasta que el pago se confirme. La pantalla lo dice
               con esas palabras. */
            <div className="animate-slide-up space-y-5 py-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-line bg-canvas-soft text-navy-700">
                <Clock className="h-8 w-8" />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-navy-500">
                  Falta un paso
                </span>
                <h4 className="text-xl font-bold text-navy-900">
                  Tu solicitud para {petName} quedó registrada
                </h4>
                <p className="mx-auto max-w-sm text-xs leading-relaxed text-navy-500">
                  La cobertura empieza cuando confirmemos el pago. En ese momento emitimos
                  el número de póliza y te enviamos el certificado al correo registrado.
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-line bg-canvas-soft p-4 text-left text-xs text-navy-500">
                <div className="flex justify-between gap-4">
                  <span>Cotización</span>
                  <span className="font-semibold tabular-nums text-navy-900">
                    {checkoutResult.policy.quoteNumber}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Titular</span>
                  <span className="font-semibold text-navy-900">{customer.fullName}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Correo registrado</span>
                  <span className="font-semibold text-navy-900">{customer.email}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Cuota</span>
                  <span className="font-semibold tabular-nums text-navy-900">
                    {formatCop(totalAmountCop)}
                    {billingFrequency === 'MONTHLY' ? ' al mes' : ' al año'}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t border-line pt-2">
                  <span>Estado</span>
                  <span className="font-semibold text-navy-900">
                    {checkoutResult.policy.status === 'ACTIVE'
                      ? 'Cobertura activa'
                      : 'Pendiente de pago'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <a
                  href={checkoutResult.initPoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-cta px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-hover"
                >
                  <span>Pagar y activar la cobertura</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-line py-2.5 text-xs font-semibold text-navy-500 transition-colors hover:bg-canvas-soft"
                >
                  Pagar después
                </button>
              </div>
            </div>
          ) : (
            /* Formulario de Checkout */
            <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
                  {errorMessage}
                </div>
              )}

              {/* Resumen de Facturación */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Resumen de Facturación
                  </span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {billingFrequency === 'MONTHLY' ? 'Pago Mensual' : 'Pago Anual'}
                  </span>
                </div>

                {petBreakdown && petBreakdown.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
                    {petBreakdown.map((item) => (
                      <div key={item.name} className="flex justify-between text-xs text-slate-700">
                        <span>Póliza de {item.name}</span>
                        <span className="font-semibold tabular-nums text-navy-900">{formatCop(item.amountCop)}/mes</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-baseline justify-between pt-2 border-t border-slate-200">
                  <span className="text-sm font-bold text-navy-900">Total a facturar:</span>
                  <span className="text-xl font-black text-navy-900 tabular-nums">
                    {formatCop(totalAmountCop)}
                    <span className="text-xs font-medium text-slate-500">/mes</span>
                  </span>
                </div>
              </div>

              {/* Datos del Tomador */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Datos del Tomador (Responsable Legal)
                </h4>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Valentina Gómez Morales"
                    value={customer.fullName}
                    onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy-900 placeholder-slate-400 focus:border-orange-cta focus:ring-1 focus:ring-orange-cta focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Cédula de Ciudadanía *</label>
                    <input
                      type="text"
                      required
                      placeholder="1020304050"
                      value={customer.nationalId}
                      onChange={(e) => setCustomer({ ...customer, nationalId: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy-900 placeholder-slate-400 focus:border-orange-cta focus:ring-1 focus:ring-orange-cta focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Celular / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      placeholder="300 123 4567"
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy-900 placeholder-slate-400 focus:border-orange-cta focus:ring-1 focus:ring-orange-cta focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    placeholder="valentina@ejemplo.com"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy-900 placeholder-slate-400 focus:border-orange-cta focus:ring-1 focus:ring-orange-cta focus:outline-none"
                  />
                </div>
              </div>

              {/* Método de Pago */}
              <div className="space-y-2.5 pt-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Método de Pago Preferido
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PSE')}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      paymentMethod === 'PSE'
                        ? 'border-2 border-orange-cta bg-orange-subtle/50 text-navy-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Landmark className="h-4 w-4 text-orange-brand" />
                    <div>
                      <div className="font-bold text-xs text-navy-900">PSE / Nequi</div>
                      <div className="text-[10px] text-slate-500">Débito bancario</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      paymentMethod === 'CREDIT_CARD'
                        ? 'border-2 border-orange-cta bg-orange-subtle/50 text-navy-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-orange-brand" />
                    <div>
                      <div className="font-bold text-xs text-navy-900">Tarjeta de Crédito</div>
                      <div className="text-[10px] text-slate-500">Visa, Master, Amex</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Habeas Data */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="habeasData"
                  checked={habeasDataAccepted}
                  onChange={(e) => setHabeasDataAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-cta focus:ring-orange-cta"
                />
                <label htmlFor="habeasData" className="text-[11px] text-slate-600 leading-tight">
                  Autorizo el tratamiento de mis datos personales según la{' '}
                  <span className="text-navy-900 font-semibold underline">Ley 1581 de 2012</span> para la
                  expedición de la póliza digital y notificaciones.
                </label>
              </div>

              {/* Botón de Enviar Naranja Minimalista */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-cta py-3.5 px-6 text-sm font-bold text-white shadow-sm hover:bg-orange-hover transition-all disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {/* Este botón no emite la póliza: registra la solicitud y
                      lleva a la pasarela. Decía "Activar Seguro", que le
                      prometía al cliente una cobertura que el pago aún no ha
                      activado. */}
                  <span>
                    {isSubmitting
                      ? 'Registrando la solicitud…'
                      : `Continuar al pago · ${formatCop(totalAmountCop)}`}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Seguridad al pie */}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Transacción cifrada TLS 1.3 • Pasarela certificada PCI-DSS</span>
        </div>
      </div>
    </div>
  );
};

export default CheckoutDrawer;

