'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { LiveClaimStatus, TimelineMilestone } from '@/types/claims';
import { claimsApi } from '@/lib/claims-api';
import { formatCop } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  FileCheck2,
  CreditCard,
  Building2,
  Receipt,
  Download,
  ExternalLink,
} from 'lucide-react';

interface LiveClaimTrackerProps {
  claimId: string;
  initialData?: LiveClaimStatus;
  onRefresh?: (data: LiveClaimStatus) => void;
}

export const LiveClaimTracker: React.FC<LiveClaimTrackerProps> = ({
  claimId,
  initialData,
  onRefresh,
}) => {
  const [claimStatus, setClaimStatus] = useState<LiveClaimStatus | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);

  const fetchStatus = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await claimsApi.getClaimLiveStatus(claimId);
      setClaimStatus(data);
      if (onRefresh) onRefresh(data);
    } catch (err: unknown) {
      console.error('Error al sincronizar estado del siniestro:', err);
      const msg = err instanceof Error ? err.message : 'No fue posible sincronizar el estado del siniestro.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [claimId, onRefresh]);

  // Polling automático cada 4 segundos mientras no esté en estado terminal
  useEffect(() => {
    if (!claimStatus) {
      fetchStatus(false);
      return;
    }

    const isTerminal = ['PAID', 'REJECTED', 'DISPUTED'].includes(claimStatus.status);
    if (isTerminal) return;

    const interval = setInterval(() => {
      fetchStatus(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [claimStatus, fetchStatus]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-white border border-line shadow-card animate-pulse space-y-4">
        <div className="h-6 w-48 bg-slate-200 rounded-full" />
        <div className="h-4 w-64 bg-slate-100 rounded-full" />
        <div className="w-full space-y-3 pt-4">
          <div className="h-16 bg-slate-50 rounded-2xl" />
          <div className="h-16 bg-slate-50 rounded-2xl" />
          <div className="h-16 bg-slate-50 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !claimStatus) {
    return (
      <div className="p-8 rounded-3xl bg-amber-50 border border-amber-200 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-navy-900">Conectando con Sué ⚡</h3>
          <p className="text-xs text-amber-900 max-w-sm mx-auto leading-relaxed">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchStatus(false)}>
          Reintentar sincronización
        </Button>
      </div>
    );
  }

  if (!claimStatus) return null;

  const isFastTrack = claimStatus.triageRoute === 'FAST_TRACK';
  const isPaid = claimStatus.status === 'PAID';
  const isRejected = claimStatus.status === 'REJECTED';

  const getStatusBadge = () => {
    switch (claimStatus.status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Reembolso Pagado 🎉
          </span>
        );
      case 'FAST_TRACK_APPROVED':
      case 'STP_APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            ⚡ Aprobado Fast-Track (3-5 min)
          </span>
        );
      case 'APPROVED_BY_ADJUSTER':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            ✓ Aprobado por Auditor Médico
          </span>
        );
      case 'MANUAL_AUDIT_REQUIRED':
      case 'HUMAN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            {claimStatus.slaCategory === 'EXPEDITED_AUDIT_24H'
              ? '🩺 Auditoría Pericial Express (< 24h)'
              : claimStatus.slaCategory === 'SPECIALIZED_REVIEW_48H'
              ? '🔬 Auditoría Médica Especializada (24-48h)'
              : '🔍 En Auditoría Médica Veterinaria'}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            ✗ Siniestro Objetado
          </span>
        );
      case 'ANALYZING_DOCUMENTS':
      case 'SUBMITTED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-subtle text-orange-brand border border-orange-brand/20">
            <span className="w-2 h-2 rounded-full bg-orange-cta animate-pulse" />
            Validando DIAN e Historia Clínica
          </span>
        );
    }
  };

  /**
   * Generación y mapeo de los 4 hitos canónicos de SCR-13 según UX_COPY.md:
   * 1. Solicitud recibida
   * 2. Factura DIAN e Historia Clínica validadas con IA
   * 3. Liquidación aprobada: Te transferiremos COP $...
   * 4. Plata en tu cuenta ...
   */
  const canonicalMilestones = [
    {
      stepNumber: 1,
      label: 'Paso 1: Solicitud recibida',
      description: 'Tu solicitud de reembolso, la factura DIAN y la Historia Clínica fueron radicadas exitosamente en la bóveda de Manto.',
      status: 'COMPLETED' as const,
      timestamp: claimStatus.updatedAt,
    },
    {
      stepNumber: 2,
      label: 'Paso 2: Factura DIAN e Historia Clínica validadas',
      description: 'Comprobamos el CUFE ante la DIAN y cruzamos la Historia Clínica con IA para verificar carencias, preexistencias y microchip.',
      status: ['ANALYZING_DOCUMENTS', 'SUBMITTED'].includes(claimStatus.status)
        ? ('IN_PROGRESS' as const)
        : isRejected
        ? ('FAILED' as const)
        : ('COMPLETED' as const),
      timestamp: claimStatus.updatedAt,
    },
    {
      stepNumber: 3,
      label: `Paso 3: Liquidación aprobada: Te transferiremos ${formatCop(claimStatus.netPayableAmountCop)}`,
      description: isRejected
        ? 'El siniestro no cumple con las condiciones de cobertura contractuales.'
        : `Reembolso aprobado tras descontar tu aporte por evento (${formatCop(claimStatus.deductibleCop)}).`,
      status: ['PAID', 'FAST_TRACK_APPROVED', 'STP_APPROVED', 'APPROVED_BY_ADJUSTER'].includes(claimStatus.status)
        ? ('COMPLETED' as const)
        : isRejected
        ? ('FAILED' as const)
        : ('IN_PROGRESS' as const),
      timestamp: claimStatus.updatedAt,
    },
    {
      stepNumber: 4,
      label: `Paso 4: Plata en tu cuenta ${claimStatus.payout?.channel || 'Bre-B'} terminada en *${(claimStatus.payout?.accountMasked || '****').slice(-4)}`,
      description: isPaid
        ? `Transferencia confirmada y dispersada exitosamente vía ${claimStatus.payout?.channel || 'Bre-B'}.`
        : isRejected
        ? 'Dispersión cancelada por objeción del siniestro.'
        : 'En cola de dispersión inmediata vía Banco de la República (Bre-B).',
      status: isPaid
        ? ('COMPLETED' as const)
        : isRejected
        ? ('FAILED' as const)
        : ('PENDING' as const),
      timestamp: claimStatus.payout?.settledAt,
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Tarjeta de Encabezado Principal */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white border border-line shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-navy-500 font-mono">
                Radicación #{claimStatus.claimNumber}
              </span>
              {refreshing && (
                <span className="text-[11px] text-orange-brand flex items-center gap-1 font-semibold animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  actualizando
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
              Reembolso de {claimStatus.petName || 'tu consentido'} 🐾
            </h2>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {/* Banner de SLA Dinámico y Tiempo de Resolución */}
        {claimStatus.slaResolutionEstimatedTime && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-canvas-soft border border-line text-xs">
            <div className="flex items-center gap-2 text-navy-700">
              <Clock className="w-4 h-4 text-orange-brand shrink-0" />
              <span>Tiempo de resolución estimado:</span>
            </div>
            <span className="font-bold text-navy-900 bg-white px-2.5 py-1 rounded-xl border border-line shadow-xs">
              {claimStatus.slaResolutionEstimatedTime}
            </span>
          </div>
        )}

        {/* Resumen de Validación Clínica con IA (Historia Clínica) */}
        {claimStatus.clinicalSummary && (
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
              <span className="font-bold text-navy-900 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Auditoría Clínica por IA (Historia Clínica)
              </span>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                Auditado
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-navy-700">
              {(claimStatus.clinicalSummary.presumptiveDiagnosis || claimStatus.clinicalSummary.diagnosis) && (
                <div>
                  <span className="text-navy-400 block text-[10px]">Diagnóstico</span>
                  <span className="font-semibold text-navy-900 truncate block">
                    {claimStatus.clinicalSummary.presumptiveDiagnosis || claimStatus.clinicalSummary.diagnosis}
                  </span>
                </div>
              )}
              {(claimStatus.clinicalSummary.symptomsOnsetDate || claimStatus.clinicalSummary.symptomsStartDate) && (
                <div>
                  <span className="text-navy-400 block text-[10px]">Inicio de Síntomas</span>
                  <span className="font-semibold text-navy-900">
                    {new Date(claimStatus.clinicalSummary.symptomsOnsetDate || claimStatus.clinicalSummary.symptomsStartDate!).toLocaleDateString('es-CO')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
              {claimStatus.clinicalSummary.preExistingSignsDetected ? (
                <span className="text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md font-semibold border border-amber-200">
                  ⚠️ Posible Preexistencia en análisis
                </span>
              ) : (
                <span className="text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-md font-semibold border border-emerald-300">
                  ✓ Sin preexistencias detectadas
                </span>
              )}
              {claimStatus.clinicalSummary.waitingPeriodCompliant !== undefined && (
                <span className={`px-2.5 py-0.5 rounded-md font-semibold border ${
                  claimStatus.clinicalSummary.waitingPeriodCompliant
                    ? 'text-emerald-800 bg-emerald-100/70 border-emerald-300'
                    : 'text-amber-800 bg-amber-50 border-amber-200'
                }`}>
                  {claimStatus.clinicalSummary.waitingPeriodCompliant ? '✓ Carencia superada' : '⚠️ En período de carencia'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Desglose Financiero Transparente (Elimina incertidumbre de "¿dónde está mi plata?") */}
        <div className="rounded-2xl bg-canvas-soft p-4 sm:p-5 border border-line space-y-3">
          <div className="flex justify-between items-center text-xs text-navy-600 pb-2 border-b border-line/60">
            <span>Total Factura Clínica</span>
            <span className="font-bold text-navy-900 text-sm tabular-nums">
              {formatCop(claimStatus.claimedAmountCop)}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs text-navy-600 pb-2 border-b border-line/60">
            <span>Tu aporte por evento (deducible)</span>
            <span className="font-semibold text-slate-700 tabular-nums">
              - {formatCop(claimStatus.deductibleCop)}
            </span>
          </div>

          <div className="flex justify-between items-center pt-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Monto depositado en tu cuenta
              </p>
              <p className="text-[11px] text-navy-500">
                {isPaid ? 'Transferido a tu billetera / banco' : 'Monto neto a transferir'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                {formatCop(claimStatus.netPayableAmountCop)}
              </span>
            </div>
          </div>
        </div>

        {/* Canal de Dispersión / Billetera Registrada */}
        {claimStatus.payout && (
          <div className="flex items-center justify-between text-xs text-navy-700 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Canal de desembolso: <strong>{claimStatus.payout.channel}</strong> ({claimStatus.payout.accountMasked})
              </span>
            </div>
            <span className="font-bold text-emerald-800 shrink-0">
              {isPaid ? '✓ Transferido' : 'En cola de envío'}
            </span>
          </div>
        )}

        {/* Notificación de Acción Requerida */}
        {claimStatus.requiresActionFromUser && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Información adicional requerida:</p>
              <p className="mt-0.5 leading-relaxed">
                {claimStatus.userActionMessage || 'Por favor contacta a soporte para adjuntar documentación complementaria.'}
              </p>
            </div>
          </div>
        )}

        {/* Botón de Comprobante si ya fue pagado */}
        {isPaid && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowVoucherModal(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-xs"
            >
              <Receipt className="w-4 h-4" />
              <span>Ver Comprobante de Transferencia Bancaria</span>
            </button>
          </div>
        )}
      </div>

      {/* Línea de Tiempo de los 4 Hitos Transaccionales (SCR-13) */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white border border-line shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-navy-900 tracking-tight">
              Seguimiento en Vivo de tu Plata
            </h3>
            <p className="text-xs text-navy-500">
              Cada etapa se actualiza automáticamente con Sué ⚡
            </p>
          </div>
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="text-xs text-orange-brand hover:text-orange-hover font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Consultando…' : 'Actualizar'}</span>
          </button>
        </div>

        <div className="relative pl-3 space-y-7 before:absolute before:left-7 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
          {canonicalMilestones.map((milestone) => {
            const isCompleted = milestone.status === 'COMPLETED';
            const isInProgress = milestone.status === 'IN_PROGRESS';
            const isFailed = milestone.status === 'FAILED';

            return (
              <div key={milestone.stepNumber} className="relative flex items-start gap-4">
                {/* Icono de Estado del Hito */}
                <div className="relative z-10 -ml-3 shrink-0">
                  {isCompleted ? (
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs ring-4 ring-emerald-50">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : isInProgress ? (
                    <div className="w-8 h-8 rounded-full bg-orange-cta text-white flex items-center justify-center font-bold text-xs shadow-cta ring-4 ring-orange-100 animate-pulse">
                      <span>{milestone.stepNumber}</span>
                    </div>
                  ) : isFailed ? (
                    <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs ring-4 ring-rose-50">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-canvas border border-line text-slate-400 flex items-center justify-center font-semibold text-xs">
                      <span>{milestone.stepNumber}</span>
                    </div>
                  )}
                </div>

                {/* Contenido del Hito */}
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`text-sm font-bold ${
                        isCompleted
                          ? 'text-navy-900'
                          : isInProgress
                          ? 'text-orange-cta'
                          : isFailed
                          ? 'text-rose-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {milestone.label}
                    </h4>
                    {milestone.timestamp && isCompleted && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(milestone.timestamp).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-navy-500 mt-1 leading-relaxed">
                    {milestone.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal / Detalle de Comprobante de Transferencia */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-line shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h4 className="text-base font-bold text-navy-900">
                  Comprobante de Reembolso Manto
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="text-slate-400 hover:text-navy-900 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-canvas-soft rounded-2xl border border-line space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-navy-500">Referencia de Pago:</span>
                <span className="font-mono font-bold text-navy-900">
                  PAY-{claimStatus.claimNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-500">Entidad de Dispersión:</span>
                <span className="font-semibold text-navy-900">Banco de la República / Bre-B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-500">Cuenta Destino:</span>
                <span className="font-semibold text-navy-900">
                  {claimStatus.payout?.channel} ({claimStatus.payout?.accountMasked})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-500">Monto Transferido:</span>
                <span className="font-bold text-emerald-700 text-sm tabular-nums">
                  {formatCop(claimStatus.netPayableAmountCop)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-500">Fecha y Hora:</span>
                <span className="font-mono text-slate-600">
                  {new Date().toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-navy-500 text-center leading-relaxed">
              Este comprobante certifica la dispersión oficial de tu reembolso veterinario en la cuenta inscrita.
            </p>

            <Button
              variant="primary"
              size="md"
              className="w-full shadow-cta"
              onClick={() => setShowVoucherModal(false)}
            >
              Entendido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveClaimTracker;
