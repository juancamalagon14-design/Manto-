'use client';

import React, { useState, useEffect } from 'react';
import { claimsApi } from '@/lib/claims-api';
import { formatCop } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ClaimEntityData, DianInvoiceItem } from '@/types/claims';

export const AdjusterClaimConsole: React.FC = () => {
  const [claims, setClaims] = useState<ClaimEntityData[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimEntityData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [filter, setFilter] = useState<'PENDING' | 'RESOLVED' | 'ALL'>('PENDING');

  // Formulario de resolución
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await claimsApi.listClaims();
      setClaims(data || []);
      if (data && data.length > 0 && !selectedClaim) {
        setSelectedClaim(data[0]);
        setApprovedAmount(Math.round(Number(data[0].netReimbursementCop || data[0].eligibleExpensesCop || 0)));
      }
    } catch (err: any) {
      console.error('Error loading claims:', err);
      setError('No fue posible cargar el listado de siniestros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, []);

  const handleSelectClaim = (c: ClaimEntityData) => {
    setSelectedClaim(c);
    setApprovedAmount(Math.round(Number(c.netReimbursementCop || c.eligibleExpensesCop || 0)));
    setNotes('');
    setRejectionReason('');
    setActionSuccess(null);
    setError(null);
  };

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedClaim) return;
    setSubmitting(true);
    setError(null);
    setActionSuccess(null);

    try {
      const payload = {
        decision,
        approvedAmountCop: decision === 'APPROVED' ? Math.max(0, Math.floor(Number(approvedAmount))) : undefined,
        adjusterNotes: notes || (decision === 'APPROVED' ? 'Liquidación aprobada conforme a póliza.' : 'Objetado tras revisión.'),
        adjusterId: 'VET-ADJUSTER-01',
        rejectionReason: decision === 'REJECTED' ? (rejectionReason || 'No cumple condiciones de cobertura.') : undefined,
      };

      await claimsApi.adjudicateClaim(selectedClaim.id, payload);
      setActionSuccess(
        decision === 'APPROVED'
          ? `¡Siniestro ${selectedClaim.claimNumber} aprobado! Dispersión financiera ordenada vía Bre-B.`
          : `Siniestro ${selectedClaim.claimNumber} rechazado con justificación registrada.`,
      );

      // Recargar lista
      await loadClaims();
    } catch (err: any) {
      console.error('Error adjudicating claim:', err);
      setError(err?.message || 'Error al procesar la decisión médica.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClaims = claims.filter((c) => {
    const isPending = ['MANUAL_AUDIT_REQUIRED', 'HUMAN_REVIEW', 'SUBMITTED', 'ANALYZING_DOCUMENTS'].includes(c.status);
    if (filter === 'PENDING') return isPending;
    if (filter === 'RESOLVED') return !isPending;
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Barra de Filtros y Estadísticas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-gray-100 shadow-sm">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-cta">
            Backoffice · Auditoría Médica Veterinaria (SCR-14)
          </span>
          <h2 className="text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            Mesa de Triage y Ajuste Clínico
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: 'PENDING', label: 'Por Auditar' },
            { id: 'RESOLVED', label: 'Resueltos' },
            { id: 'ALL', label: 'Todos' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === item.id
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
          <Button variant="secondary" size="sm" onClick={loadClaims} disabled={loading}>
            {loading ? 'Cargando...' : '↻ Refrescar'}
          </Button>
        </div>
      </div>

      {/* Layout Split: Bandeja Izquierda + Panel de Resolución Derecho */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Bandeja de Siniestros */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
            Reclamaciones ({filteredClaims.length})
          </div>

          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {filteredClaims.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white border border-gray-100 text-gray-400 text-xs">
                No hay siniestros en este estado.
              </div>
            ) : (
              filteredClaims.map((claim) => {
                const isSelected = selectedClaim?.id === claim.id;
                const isManual = ['MANUAL_AUDIT_REQUIRED', 'HUMAN_REVIEW'].includes(claim.status);
                const isPaid = claim.status === 'PAID';

                return (
                  <button
                    key={claim.id}
                    onClick={() => handleSelectClaim(claim)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-orange-cta bg-orange-50/40 ring-2 ring-orange-200 shadow-sm'
                        : 'border-gray-200/80 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-navy-900 font-mono">
                        {claim.claimNumber}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : isManual
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {claim.status}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-navy-800">
                      Incidente: {claim.incidentType}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      {claim.slaCategory === 'FAST_TRACK_MINUTES' || Number(claim.eligibleExpensesCop || 0) <= 200000 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ⚡ Fast-Track (&le;200k)
                        </span>
                      ) : claim.slaCategory === 'SPECIALIZED_REVIEW_48H' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          🔬 Auditoría 48h
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          🩺 Express &lt;24h (&gt;200k)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                      <span>Total: {formatCop(Number(claim.eligibleExpensesCop || 0))}</span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(claim.submittedAt).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Detalle Clínico & Panel de Decisión */}
        <div className="lg:col-span-8">
          {selectedClaim ? (
            <div className="space-y-6">
              {/* Notificación de Éxito o Error */}
              {actionSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                  {actionSuccess}
                </div>
              )}
              {error && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              {/* Tarjeta de Información Clínica y Soportes */}
              <div className="p-6 rounded-3xl bg-white border border-gray-100 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                  <div>
                    <span className="text-xs font-mono text-gray-400">ID: {selectedClaim.id}</span>
                    <h3 className="text-xl font-bold text-navy-900 mt-0.5">
                      {selectedClaim.claimNumber} · {selectedClaim.incidentType}
                    </h3>
                  </div>
                  <div className="text-xs text-gray-500">
                    Póliza vinculada: <strong>{selectedClaim.policyNumber}</strong>
                  </div>
                </div>

                {/* Motivos de Triage / Alertas de Auditoría */}
                {selectedClaim.triageReasons && selectedClaim.triageReasons.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-1.5">
                    <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <span>⚠️ Alertas de Triage Detectadas por IA:</span>
                    </div>
                    <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                      {selectedClaim.triageReasons.map((reason: string, i: number) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Datos de la Historia Clínica y Auditoría Pericial IA */}
                <div className="space-y-3 p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <span>🩺 Historia Clínica & Auditoría Pericial IA</span>
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Obligatoria · Verificada
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 font-medium">Inicio de Síntomas</p>
                      <p className="font-semibold text-navy-900 mt-0.5">
                        {(selectedClaim.clinicalRecord?.symptomsOnsetDate || selectedClaim.clinicalRecord?.symptomsStartDate)
                          ? new Date(selectedClaim.clinicalRecord.symptomsOnsetDate || selectedClaim.clinicalRecord.symptomsStartDate!).toLocaleDateString('es-CO')
                          : 'No registrado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">Veterinario Tratante</p>
                      <p className="font-semibold text-navy-900 mt-0.5 truncate">
                        {selectedClaim.clinicalRecord?.veterinarianName || selectedClaim.clinicalRecord?.attendingVetName || 'Clínico de Urgencias'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">Microchip Mascota</p>
                      <p className="font-semibold text-navy-900 mt-0.5">
                        {selectedClaim.clinicalRecord?.microchipNumber || selectedClaim.clinicalRecord?.extractedMicrochip || 'Verificado en HC'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">SLA Objetivo</p>
                      <p className="font-semibold text-orange-brand mt-0.5">
                        {selectedClaim.slaResolutionEstimatedTime || (Number(selectedClaim.eligibleExpensesCop || 0) <= 200000 ? '3 a 5 min' : '< 24h hábiles')}
                      </p>
                    </div>
                  </div>

                  {(selectedClaim.clinicalRecord?.presumptiveDiagnosis || selectedClaim.clinicalRecord?.confirmedDiagnosis) && (
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100 text-xs text-navy-800">
                      <span className="font-bold text-gray-500 block text-[10px] uppercase">Diagnóstico Presuntivo / Confirmado</span>
                      <p className="mt-0.5 leading-relaxed">{selectedClaim.clinicalRecord.presumptiveDiagnosis || selectedClaim.clinicalRecord.confirmedDiagnosis}</p>
                    </div>
                  )}

                  {/* Semáforo de Preexistencias y Microchip */}
                  <div className="flex flex-wrap gap-2 pt-1 text-xs">
                    {(selectedClaim.clinicalRecord?.hasPreExistingSigns || selectedClaim.clinicalRecord?.preExistingSignsDetected) ? (
                      <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 font-semibold border border-red-200">
                        🚨 Alerta: Signos de patología previa a vigencia
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                        ✓ Sin preexistencias detectadas
                      </span>
                    )}

                    {selectedClaim.clinicalRecord?.petMicrochipMatch === false ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                        ⚠️ Alerta: Microchip no coincide con la póliza
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                        ✓ Identidad de mascota confirmada
                      </span>
                    )}
                  </div>
                </div>

                {/* Datos de la Factura DIAN */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Soporte Fiscal DIAN & Prestador Veterinario
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3.5 rounded-2xl text-xs">
                    <div>
                      <p className="text-gray-400 font-medium">Factura N°</p>
                      <p className="font-semibold text-navy-900 mt-0.5 font-mono">
                        {selectedClaim.dianInvoice?.invoiceNumber || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">NIT Clínica</p>
                      <p className="font-semibold text-navy-900 mt-0.5">
                        {selectedClaim.dianInvoice?.providerNit || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">Razón Social</p>
                      <p className="font-semibold text-navy-900 mt-0.5 truncate">
                        {selectedClaim.dianInvoice?.providerName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">Confianza OCR</p>
                      <p className="font-semibold text-emerald-700 mt-0.5">
                        {((selectedClaim.dianInvoice?.ocrConfidence || 0.95) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gray-50 text-[11px] font-mono text-gray-500 break-all">
                    CUFE: {selectedClaim.dianInvoice?.dianCufe || 'No registrado'}
                  </div>
                </div>

                {/* Ítems Médicos Facturados */}
                {selectedClaim.dianInvoice?.items && selectedClaim.dianInvoice.items.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Partidas Clínicas Extraídas
                    </h4>
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                          <tr>
                            <th className="p-3">Categoría</th>
                            <th className="p-3">Descripción</th>
                            <th className="p-3 text-right">Monto</th>
                            <th className="p-3 text-center">Cubierto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedClaim.dianInvoice.items.map((it: DianInvoiceItem, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="p-3 font-semibold text-navy-800">{it.category}</td>
                              <td className="p-3 text-gray-600">{it.description}</td>
                              <td className="p-3 text-right font-medium">{formatCop(Number(it.amountCop))}</td>
                              <td className="p-3 text-center">
                                {it.isCovered ? (
                                  <span className="text-emerald-600 font-bold">✓ Sí</span>
                                ) : (
                                  <span className="text-red-500 font-semibold">✗ No</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel de Decisión y Resolución Médica */}
              <div className="p-6 rounded-3xl bg-white border border-gray-100 shadow-sm space-y-5">
                <h4 className="text-base font-bold text-navy-900">
                  Dictamen Pericial y Orden de Dispersión
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700">
                      Monto Aprobado para Reembolso (en Pesos COP)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-orange-cta"
                    />
                    <span className="text-[11px] text-gray-500">
                      Equivalente: {formatCop(approvedAmount)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700">
                      Destino de Pago Registrado
                    </label>
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                      <p className="font-semibold text-navy-900">
                        {selectedClaim.breBKey?.type || 'Cuenta'}: {selectedClaim.breBKey?.value || 'N/A'}
                      </p>
                      <p className="text-gray-400 mt-0.5">Dispersión instantánea Bre-B</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    Notas y Fundamento del Ajustador Médico
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Justificación médica de la liquidación o solicitud de soportes adicionales..."
                    className="w-full p-3 rounded-xl border border-gray-200 text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-orange-cta resize-none"
                  />
                </div>

                {/* Si se desea objetar */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    Causal de Objeción / Rechazo (Solo si se rechaza el siniestro)
                  </label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ej. Procedimiento estético o patología en período de carencia contractual..."
                    className="w-full p-2.5 rounded-xl border border-gray-200 text-xs text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <Button
                    variant="danger"
                    size="lg"
                    className="w-1/3"
                    disabled={submitting}
                    onClick={() => handleDecision('REJECTED')}
                  >
                    {submitting ? 'Procesando...' : 'Rechazar Siniestro'}
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-2/3"
                    disabled={submitting || approvedAmount <= 0}
                    onClick={() => handleDecision('APPROVED')}
                  >
                    {submitting
                      ? 'Dispersando...'
                      : `Aprobar y Pagar ${formatCop(approvedAmount)} ⚡`}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl bg-white border border-gray-100 text-gray-400">
              Selecciona una reclamación de la bandeja izquierda para auditarla.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AdjusterClaimConsole;
