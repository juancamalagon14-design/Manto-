'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  IncidentType,
  PayoutChannel,
  BreBKeyType,
  SubmitClaimRequest,
  SubmitClaimResponse,
  SaveClaimDraftDto,
  ClaimDraftFormData,
} from '@/types/claims';
import { claimsApi, calculateFileSha256 } from '@/lib/claims-api';
import { formatCop } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LiveClaimTracker } from './LiveClaimTracker';
import {
  Camera,
  UploadCloud,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Smartphone,
  CreditCard,
  Building2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  HeartHandshake,
  Stethoscope,
  FileCheck,
  Check,
  Receipt,
  Zap,
  RotateCcw,
} from 'lucide-react';

interface ClaimsStepperProps {
  policyId: string;
  petName?: string;
  policyNumber?: string;
  onSuccess?: (response: SubmitClaimResponse) => void;
}

const DRAFT_STORAGE_KEY = 'claim_draft_v1';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

const INCIDENT_OPTIONS: { id: IncidentType; label: string; desc: string }[] = [
  {
    id: 'ACCIDENT',
    label: 'Accidente / Urgencia médica',
    desc: 'Traumas, suturas, fracturas, caídas, intoxicación o heridas súbitas',
  },
  {
    id: 'COMMON_ILLNESS',
    label: 'Enfermedad común',
    desc: 'Infecciones, vómitos persistentes, cuadros gastrointestinales o virosis',
  },
  {
    id: 'EMERGENCY_CONSULTATION',
    label: 'Exámenes de diagnóstico y farmacia',
    desc: 'Radiografías, ecografías, cuadros hemáticos o medicamentos formulados',
  },
  {
    id: 'CIVIL_LIABILITY_1801',
    label: 'Daños a terceros (Responsabilidad Civil)',
    desc: 'Responsabilidad Civil Extracontractual por lesiones o daños a terceros',
  },
  {
    id: 'PREVENTIVE_WELLNESS',
    label: 'Bienestar preventivo',
    desc: 'Vacunación anual, desparasitación o chequeo de rutina según amparo contratado',
  },
];

const PAYOUT_CHANNELS: { id: PayoutChannel; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'BRE_B',
    label: 'Bre-B Inmediato',
    desc: 'Transferencia interoperable Banco de la República (en segundos)',
    icon: <Sparkles className="w-5 h-5 text-orange-brand" />,
  },
  {
    id: 'NEQUI',
    label: 'Nequi',
    desc: 'Billetera digital Bancolombia directa a tu celular',
    icon: <Smartphone className="w-5 h-5 text-purple-600" />,
  },
  {
    id: 'DAVIPLATA',
    label: 'DaviPlata',
    desc: 'Billetera móvil Davivienda sin costo de retiro',
    icon: <CreditCard className="w-5 h-5 text-red-600" />,
  },
  {
    id: 'BANK_TRANSFER_ACH',
    label: 'Cuenta Bancaria',
    desc: 'Ahorros o Corriente en cualquier banco de Colombia',
    icon: <Building2 className="w-5 h-5 text-blue-600" />,
  },
];

export const ClaimsStepper: React.FC<ClaimsStepperProps> = ({
  policyId,
  petName = 'tu mascota',
  policyNumber = 'MTO-POL-ACTIVA',
  onSuccess,
}) => {
  // Estado del paso actual (1 a 4)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle de pruebas dev/QA: Requerir soportes (producción, default) vs Soportes opcionales (bypass)
  const [requireDocuments, setRequireDocuments] = useState<boolean>(true);
  const bypassSoportesPruebas = !requireDocuments;
  const setBypassSoportesPruebas = (val: boolean) => setRequireDocuments(!val);

  // Estado si ya se radicó exitosamente
  const [createdClaimId, setCreatedClaimId] = useState<string | null>(null);

  // Form Data - Paso 1
  const [incidentType, setIncidentType] = useState<IncidentType>('ACCIDENT');
  const [incidentDate, setIncidentDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [description, setDescription] = useState<string>('');

  // Form Data - Paso 2: Factura Electrónica DIAN
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileSha256, setFileSha256] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [providerNit, setProviderNit] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');
  const [dianCufe, setDianCufe] = useState<string>('');
  const [claimedAmount, setClaimedAmount] = useState<number>(0);

  // Form Data - Paso 2: Historia Clínica / Epicrisis (OBLIGATORIA PARA CUALQUIER TRÁMITE)
  const [uploadingClinical, setUploadingClinical] = useState<boolean>(false);
  const [uploadedClinicalDocId, setUploadedClinicalDocId] = useState<string | null>(null);
  const [uploadedClinicalFileName, setUploadedClinicalFileName] = useState<string | null>(null);
  const [clinicalSha256, setClinicalSha256] = useState<string>('');
  const [clinicalPreviewUrl, setClinicalPreviewUrl] = useState<string | null>(null);
  const [symptomsStartDate, setSymptomsStartDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [confirmedDiagnosis, setConfirmedDiagnosis] = useState<string>('');
  const [attendingVetName, setAttendingVetName] = useState<string>('');
  const [petMicrochip, setPetMicrochip] = useState<string>('');

  const clinicalFileInputRef = useRef<HTMLInputElement | null>(null);
  const clinicalCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Consentimiento Habeas Data (Ley 1581 de 2012)
  const [habeasDataConsent, setHabeasDataConsent] = useState<boolean>(true);

  // Form Data - Paso 3 (Dispersión / Pago)
  const [payoutChannel, setPayoutChannel] = useState<PayoutChannel>('BRE_B');
  const [breBType, setBreBType] = useState<BreBKeyType>('PHONE_NUMBER');
  const [breBValue, setBreBValue] = useState<string>('');

  // Persistencia de 24 Horas (localStorage 'claim_draft_v1' y endpoint de draft)
  const [draftRestoredNotice, setDraftRestoredNotice] = useState<string | null>(null);

  const persistDraft = useCallback(
    (stepOverride?: number, customData?: Partial<ClaimDraftFormData>) => {
      try {
        const formData: ClaimDraftFormData = {
          incidentType: customData?.incidentType ?? incidentType,
          incidentDate: customData?.incidentDate ?? incidentDate,
          description: customData?.description ?? description,
          claimedAmount: customData?.claimedAmount ?? claimedAmount,
          invoiceNumber: customData?.invoiceNumber ?? invoiceNumber,
          providerNit: customData?.providerNit ?? providerNit,
          providerName: customData?.providerName ?? providerName,
          dianCufe: customData?.dianCufe ?? dianCufe,
          uploadedDocId: customData?.uploadedDocId !== undefined ? customData.uploadedDocId : uploadedDocId,
          uploadedFileName: customData?.uploadedFileName !== undefined ? customData.uploadedFileName : uploadedFileName,
          fileSha256: customData?.fileSha256 ?? fileSha256,
          uploadedClinicalDocId: customData?.uploadedClinicalDocId !== undefined ? customData.uploadedClinicalDocId : uploadedClinicalDocId,
          uploadedClinicalFileName: customData?.uploadedClinicalFileName !== undefined ? customData.uploadedClinicalFileName : uploadedClinicalFileName,
          clinicalSha256: customData?.clinicalSha256 ?? clinicalSha256,
          symptomsStartDate: customData?.symptomsStartDate ?? symptomsStartDate,
          confirmedDiagnosis: customData?.confirmedDiagnosis ?? confirmedDiagnosis,
          attendingVetName: customData?.attendingVetName ?? attendingVetName,
          petMicrochip: customData?.petMicrochip ?? petMicrochip,
          payoutChannel: customData?.payoutChannel ?? payoutChannel,
          breBType: customData?.breBType ?? breBType,
          breBValue: customData?.breBValue ?? breBValue,
          habeasDataConsent: customData?.habeasDataConsent ?? habeasDataConsent,
        };

        const draft: SaveClaimDraftDto = {
          policyId,
          currentStep: stepOverride ?? currentStep,
          formData,
          savedAtTimestamp: Date.now(),
        };

        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        claimsApi.saveDraft(draft).catch(() => {});
      } catch {
        // Ignorar si localStorage no está disponible
      }
    },
    [
      policyId,
      currentStep,
      incidentType,
      incidentDate,
      description,
      claimedAmount,
      invoiceNumber,
      providerNit,
      providerName,
      dianCufe,
      uploadedDocId,
      uploadedFileName,
      fileSha256,
      uploadedClinicalDocId,
      uploadedClinicalFileName,
      clinicalSha256,
      symptomsStartDate,
      confirmedDiagnosis,
      attendingVetName,
      petMicrochip,
      payoutChannel,
      breBType,
      breBValue,
      habeasDataConsent,
    ],
  );

  // Carga y rehidratación de borrador de 24 horas al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed: SaveClaimDraftDto = JSON.parse(raw);
      const now = Date.now();
      const ageMs = now - (parsed.savedAtTimestamp || 0);

      if (ageMs > DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }

      const d = parsed.formData;
      if (d) {
        if (d.incidentType) setIncidentType(d.incidentType);
        if (d.incidentDate) setIncidentDate(d.incidentDate);
        if (d.description) setDescription(d.description);
        if (d.claimedAmount) setClaimedAmount(d.claimedAmount);
        if (d.invoiceNumber) setInvoiceNumber(d.invoiceNumber);
        if (d.providerNit) setProviderNit(d.providerNit);
        if (d.providerName) setProviderName(d.providerName);
        if (d.dianCufe) setDianCufe(d.dianCufe);
        if (d.uploadedDocId) setUploadedDocId(d.uploadedDocId);
        if (d.uploadedFileName) setUploadedFileName(d.uploadedFileName);
        if (d.fileSha256) setFileSha256(d.fileSha256);
        if (d.uploadedClinicalDocId) setUploadedClinicalDocId(d.uploadedClinicalDocId);
        if (d.uploadedClinicalFileName) setUploadedClinicalFileName(d.uploadedClinicalFileName);
        if (d.clinicalSha256) setClinicalSha256(d.clinicalSha256);
        if (d.symptomsStartDate) setSymptomsStartDate(d.symptomsStartDate);
        if (d.confirmedDiagnosis) setConfirmedDiagnosis(d.confirmedDiagnosis);
        if (d.attendingVetName) setAttendingVetName(d.attendingVetName);
        if (d.petMicrochip) setPetMicrochip(d.petMicrochip);
        if (d.payoutChannel) setPayoutChannel(d.payoutChannel);
        if (d.breBType) setBreBType(d.breBType);
        if (d.breBValue) setBreBValue(d.breBValue);
        if (typeof d.habeasDataConsent === 'boolean') setHabeasDataConsent(d.habeasDataConsent);
        if (parsed.currentStep && parsed.currentStep >= 1 && parsed.currentStep <= 4) {
          setCurrentStep(parsed.currentStep);
        }

        const minutesAgo = Math.max(1, Math.round(ageMs / 60000));
        const timeAgoText = minutesAgo < 60 ? `hace ${minutesAgo} min` : `hace ${Math.round(minutesAgo / 60)} horas`;
        setDraftRestoredNotice(`Continuando tu reembolso anterior (${timeAgoText})`);
      }
    } catch {
      // Ignorar fallos de parsing
    }
  }, []);

  const descartarBorrador = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      claimsApi.deleteDraft(policyId).catch(() => {});
    } catch {}
    setDraftRestoredNotice(null);
    setCurrentStep(1);
    setDescription('');
    setClaimedAmount(0);
    setUploadedDocId(null);
    setUploadedFileName(null);
    setUploadedClinicalDocId(null);
    setUploadedClinicalFileName(null);
  };

  // Handler de carga de Factura DIAN a almacenamiento seguro
  const processUploadedFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      setError('La factura excede el tamaño máximo permitido de 25MB.');
      return;
    }

    setUploadingFile(true);
    setError(null);

    try {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }

      const checksum = await calculateFileSha256(file);
      setFileSha256(checksum);

      const presigned = await claimsApi.generatePresignedUrl({
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        fileSizeBytes: file.size,
        documentType: 'DIAN_INVOICE',
        sha256Checksum: checksum,
      });

      await claimsApi.uploadFileToStorage(file, presigned);

      setUploadedDocId(presigned.documentId);
      setUploadedFileName(file.name);

      const generatedInv = invoiceNumber || `FE-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedCufe = dianCufe || `cufe_${checksum.slice(0, 24)}`;

      if (!invoiceNumber) {
        setInvoiceNumber(generatedInv);
      }
      if (!dianCufe) {
        setDianCufe(generatedCufe);
      }

      // Persistir de inmediato el soporte en el borrador de 24 horas
      persistDraft(currentStep, {
        uploadedDocId: presigned.documentId,
        uploadedFileName: file.name,
        fileSha256: checksum,
        invoiceNumber: generatedInv,
        dianCufe: generatedCufe,
      });
    } catch (err: unknown) {
      console.error('Error al subir factura DIAN:', err);
      const msg = err instanceof Error ? err.message : 'Error al cargar la factura a la bóveda segura.';
      setError(msg);
    } finally {
      setUploadingFile(false);
    }
  };

  // Handler de carga de Historia Clínica / Epicrisis (OBLIGATORIA)
  const processUploadedClinicalFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      setError('La historia clínica excede el tamaño máximo permitido de 25MB.');
      return;
    }

    setUploadingClinical(true);
    setError(null);

    try {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setClinicalPreviewUrl(url);
      } else {
        setClinicalPreviewUrl(null);
      }

      const checksum = await calculateFileSha256(file);
      setClinicalSha256(checksum);

      const presigned = await claimsApi.generatePresignedUrl({
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        fileSizeBytes: file.size,
        documentType: 'MEDICAL_HISTORY_EPICRISIS',
        sha256Checksum: checksum,
      });

      await claimsApi.uploadFileToStorage(file, presigned);

      setUploadedClinicalDocId(presigned.documentId);
      setUploadedClinicalFileName(file.name);

      const genDiag = confirmedDiagnosis || `Evaluación clínica veterinaria para ${petName}`;
      if (!confirmedDiagnosis) {
        setConfirmedDiagnosis(genDiag);
      }

      // Persistir de inmediato la historia clínica en el borrador de 24 horas
      persistDraft(currentStep, {
        uploadedClinicalDocId: presigned.documentId,
        uploadedClinicalFileName: file.name,
        clinicalSha256: checksum,
        confirmedDiagnosis: genDiag,
      });
    } catch (err: unknown) {
      console.error('Error al subir historia clínica:', err);
      const msg = err instanceof Error ? err.message : 'Error al cargar la historia clínica a la bóveda segura.';
      setError(msg);
    } finally {
      setUploadingClinical(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleClinicalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedClinicalFile(file);
    }
  };

  // Envío final del siniestro (FNOL)
  const handleSubmit = async () => {
    if (!habeasDataConsent) {
      setError('Debes autorizar el tratamiento de datos personales conforme a la Ley 1581 de 2012 para proceder.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const docIds: string[] = [];
      if (uploadedDocId) docIds.push(uploadedDocId);
      if (uploadedClinicalDocId) docIds.push(uploadedClinicalDocId);

      const bypassActivo = bypassSoportesPruebas;
      const finalAmount = claimedAmount > 0 ? claimedAmount : (bypassActivo ? 150000 : 0);
      const finalInvoiceNumber = invoiceNumber || (bypassActivo ? `FE-TEST-${Math.floor(100000 + Math.random() * 900000)}` : `FE-${Date.now().toString().slice(-6)}`);
      const finalNit = providerNit || '901234567-8';
      const finalName = providerName || (bypassActivo ? 'Clínica Veterinaria Manto Red (Demo)' : 'Clínica Veterinaria Manto Red');
      const finalCufe = dianCufe || `cufe_${fileSha256.slice(0, 16) || Date.now()}`;
      const finalDiagnosis = confirmedDiagnosis || description || (bypassActivo ? `Atención veterinaria para ${petName} (Bypass de pruebas)` : 'Atención médica veterinaria');
      const finalVet = attendingVetName || (bypassActivo ? 'Dr. Veterinario Manto (TP 99881)' : 'Médico Veterinario Colegiado');
      const finalBreB = breBValue.trim() || (bypassActivo ? '3001234567' : '');

      const payload: SubmitClaimRequest = {
        policyId,
        incidentType,
        incidentDate: new Date(incidentDate).toISOString(),
        description: description || `Atención de urgencia veterinaria para ${petName}`,
        eligibleExpensesCop: finalAmount,
        claimedAmountCop: finalAmount,
        documentIds: docIds,
        dianInvoice: {
          invoiceNumber: finalInvoiceNumber,
          providerNit: finalNit,
          providerName: finalName,
          dianCufe: finalCufe,
          issueDate: new Date(incidentDate).toISOString(),
          items: [
            {
              description: description || 'Atención médica veterinaria de urgencia',
              amountCop: finalAmount,
              isCovered: true,
              category: 'URGENCY',
            },
          ],
          totalInvoiceCop: finalAmount,
          ocrConfidence: 0.96,
        },
        clinicalRecord: {
          documentId: uploadedClinicalDocId || undefined,
          documentType: 'MEDICAL_HISTORY_EPICRISIS',
          symptomsOnsetDate: symptomsStartDate ? new Date(symptomsStartDate).toISOString() : new Date(incidentDate).toISOString(),
          presumptiveDiagnosis: finalDiagnosis,
          veterinarianName: finalVet,
          microchipNumber: petMicrochip || undefined,
          hasPreExistingSigns: false,
          ocrConfidence: 0.95,
          // Aliases para compatibilidad interna
          symptomsStartDate: symptomsStartDate ? new Date(symptomsStartDate).toISOString() : new Date(incidentDate).toISOString(),
          confirmedDiagnosis: finalDiagnosis,
          attendingVetName: finalVet,
          petMicrochipMatch: petMicrochip ? true : null,
          extractedMicrochip: petMicrochip || undefined,
        },
        breBKey: {
          type: breBType,
          value: finalBreB,
        },
        payoutChannel,
        payoutAccountIdentifier: finalBreB,
      };

      const response = await claimsApi.submitClaim(payload);
      setCreatedClaimId(response.claimId);

      // Limpiar borrador de 24 horas tras radicación formal exitosa
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        claimsApi.deleteDraft(policyId).catch(() => {});
      } catch {}

      if (onSuccess) onSuccess(response);
    } catch (err: unknown) {
      console.error('Error al radicar siniestro:', err);
      const msg = err instanceof Error ? err.message : 'Ocurrió un error al radicar la reclamación.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Si ya se radicó con éxito, mostrar mensaje empático y el LiveClaimTracker
  if (createdClaimId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="p-6 rounded-3xl bg-emerald-50/80 border border-emerald-200 text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-navy-900 tracking-tight">
              ¡Recibimos tu solicitud para {petName}! 🐾
            </h2>
            <p className="text-sm text-emerald-900 max-w-lg mx-auto leading-relaxed">
              Nuestro sistema está validando la factura. Si todo está en orden, recibirás el dinero en tu cuenta en cuestión de horas.
            </p>
          </div>
        </div>

        <LiveClaimTracker claimId={createdClaimId} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-white border border-line shadow-card space-y-6">
      {/* Switch Reactivo de Pruebas / Dev: Requerir soportes vs Soportes opcionales */}
      <div className="flex items-center justify-between pb-3 border-b border-line-soft">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-navy-500">
            Modo de Validación
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-navy-700">
            {requireDocuments ? 'Requerir soportes (Producción)' : 'Soportes opcionales (Bypass dev)'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={requireDocuments}
            onClick={() => setRequireDocuments((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              requireDocuments ? 'bg-navy-900' : 'bg-orange-cta'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                requireDocuments ? 'translate-x-0' : 'translate-x-5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notificación de Persistencia 24 Horas */}
      {draftRestoredNotice && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-orange-subtle border border-orange-border/80 text-xs text-orange-brand animate-fade-in">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 shrink-0 text-orange-cta" />
            <span className="font-semibold text-navy-900">{draftRestoredNotice}</span>
          </div>
          <button
            type="button"
            onClick={descartarBorrador}
            className="text-[11px] underline font-bold text-navy-700 hover:text-navy-950 transition-colors"
          >
            Descartar y empezar de nuevo
          </button>
        </div>
      )}

      {/* Barra de Progreso Superior */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-navy-500 font-semibold">
          <span>Paso {currentStep} de 4</span>
          <span className="text-navy-900">
            {currentStep === 1 && '¿Qué le ocurrió?'}
            {currentStep === 2 && 'Factura y Soportes'}
            {currentStep === 3 && '¿Dónde te transferimos?'}
            {currentStep === 4 && 'Confirmación y Envío'}
          </span>
        </div>
        <ProgressBar current={currentStep} total={4} variant="compact" />
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* ================= PASO 1: MOTIVO Y FECHA (SCR-12) ================= */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-navy-900 tracking-tight">
              ¿Qué le ocurrió a {petName}?
            </h3>
            <p className="text-xs text-navy-500 mt-1 leading-relaxed">
              Selecciona el tipo de evento y cuéntanos brevemente lo ocurrido para orientar tu trámite de reembolso.
            </p>
          </div>

          {/* Listado tipográfico minimalista sin cajas pesadas ni etiquetas fast track/clínica */}
          <div className="divide-y divide-line-soft border-y border-line-soft">
            {INCIDENT_OPTIONS.map((item) => {
              const isSelected = incidentType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIncidentType(item.id);
                    persistDraft(1, { incidentType: item.id });
                  }}
                  aria-pressed={isSelected}
                  className={`w-full flex items-start gap-3.5 py-3.5 px-2 text-left transition-colors rounded-xl ${
                    isSelected
                      ? 'bg-orange-subtle/30 text-navy-950 font-medium'
                      : 'hover:bg-canvas/60 text-navy-800'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      isSelected
                        ? 'border-orange-cta bg-orange-cta'
                        : 'border-navy-300 bg-white'
                    }`}
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className={`text-sm block ${isSelected ? 'font-bold text-navy-950' : 'font-semibold text-navy-900'}`}>
                      {item.label}
                    </span>
                    <p className="text-xs text-navy-500 mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Aviso pericial para Daños a terceros (Responsabilidad Civil) */}
          {incidentType === 'CIVIL_LIABILITY_1801' && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 space-y-2.5 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                  Gestión en Desarrollo Asistido · Mesa Pericial
                </h4>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                La gestión de siniestros por <strong>Daños a terceros (Responsabilidad Civil)</strong> está en desarrollo asistido con la mesa pericial legal de Manto. Nuestro equipo pericial te acompañará directamente en la mediación y recopilación de soportes legales (amparo legal de 50 SMLMV: $87.545.250 COP).
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-800">
              ¿Cuándo ocurrió el evento?
            </label>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={incidentDate}
              onChange={(e) => {
                setIncidentDate(e.target.value);
                persistDraft(1, { incidentDate: e.target.value });
              }}
              className="w-full p-3.5 rounded-xl border border-line bg-canvas-pure text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-orange-cta transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-800">
              Breve descripción médica de lo sucedido
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                persistDraft(1, { description: e.target.value });
              }}
              placeholder={`Ej. ${petName} vomitó varias veces después del paseo y lo llevamos a urgencias a que le aplicaran suero y medicamentos.`}
              className="w-full p-3.5 rounded-xl border border-line bg-canvas-pure text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-cta resize-none transition-all"
            />
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full min-h-[50px] shadow-cta"
              onClick={() => {
                if (!incidentDate) {
                  setError('Por favor indica la fecha en que ocurrió el evento.');
                  return;
                }
                setError(null);
                setCurrentStep(2);
                persistDraft(2, { incidentType, incidentDate, description });
              }}
            >
              <span>Continuar a Factura y Soportes</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ================= PASO 2: FACTURA Y HISTORIA CLÍNICA (OBLIGATORIA) ================= */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-navy-900 tracking-tight">
              Sube los soportes obligatorios de la atención
            </h3>
            <p className="text-xs text-navy-500 mt-1 leading-relaxed">
              Para garantizar desembolsos en tiempo récord y verificar coberturas, requerimos la <strong>Factura DIAN</strong> y la <strong>Historia Clínica / Epicrisis</strong> de la veterinaria.
            </p>
          </div>

          {/* Toggle de Pruebas: Requerir soportes (Producción) vs Soportes opcionales (Bypass) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-2xl bg-canvas-soft border border-line">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-navy-900">Modo de prueba (Entorno de pruebas / QA)</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    !requireDocuments
                      ? 'bg-orange-subtle text-orange-brand border border-orange-border'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {!requireDocuments ? 'Soportes opcionales (Bypass activo)' : 'Requerir soportes (Producción)'}
                </span>
              </div>
              <p className="text-[11px] text-navy-500">
                {!requireDocuments
                  ? 'Permite avanzar sin cargar archivos físicos (genera automáticamente datos sintéticos válidos para pruebas).'
                  : 'Validación estricta de producción: exige Factura DIAN e Historia Clínica / Epicrisis.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!requireDocuments}
              onClick={() => setRequireDocuments(!requireDocuments)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                !requireDocuments ? 'bg-orange-cta' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  !requireDocuments ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Banner Dinámico de Nivel de Riesgo y SLA de Pago */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              claimedAmount > 0 && claimedAmount <= 200000
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900'
                : claimedAmount > 200000
                ? 'bg-blue-50/90 border-blue-300 text-blue-900'
                : 'bg-canvas-soft border-line text-navy-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  claimedAmount > 0 && claimedAmount <= 200000
                    ? 'bg-emerald-100 text-emerald-700'
                    : claimedAmount > 200000
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-canvas-pure border border-line text-navy-700'
                }`}
              >
                {claimedAmount > 0 && claimedAmount <= 200000 ? (
                  <Zap className="w-5 h-5 text-emerald-700" />
                ) : claimedAmount > 200000 ? (
                  <Stethoscope className="w-5 h-5 text-blue-700" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-navy-700" />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider">
                  {claimedAmount > 0 && claimedAmount <= 200000
                    ? 'Trámite de Bajo Riesgo · Fast-Track STP (≤ $200.000 COP)'
                    : claimedAmount > 200000
                    ? 'Autenticación Pericial Express · SCR-14 (> $200.000 COP)'
                    : 'Tiempos de Liquidación y Desembolso Manto'}
                </div>
                <p className="text-xs leading-relaxed">
                  {claimedAmount > 0 && claimedAmount <= 200000
                    ? 'Tu siniestro califica para liquidación inmediata por Bre-B en 3 a 5 minutos. El motor cruzará la Historia Clínica y la DIAN para verificar carencias y preexistencias en tiempo real.'
                    : claimedAmount > 200000
                    ? 'Al superar los $200.000 COP, el caso pasa a autenticación pericial médica por un médico veterinario colegiado. Tiempo estimado de pago: Menor a 24 horas hábiles.'
                    : 'Montos hasta $200.000 COP se liquidan en 3 a 5 minutos por Bre-B (Fast-Track STP). Montos superiores se procesan mediante Autenticación Pericial Express en menos de 24 horas hábiles.'}
                </p>
              </div>
            </div>
          </div>

          {/* SOPORTE 1: FACTURA ELECTRÓNICA DIAN */}
          <div className="p-5 rounded-3xl bg-canvas-soft border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-subtle text-orange-brand">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">1. Factura Electrónica DIAN</h4>
                  <p className="text-[11px] text-navy-500">Foto o PDF con CUFE visible</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full">
                Obligatorio
              </span>
            </div>

            {/* Inputs ocultos factura */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Dropzone Factura */}
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-orange-cta transition-colors bg-canvas-pure">
              {uploadedDocId ? (
                <div className="space-y-2">
                  <div className="inline-flex p-2.5 rounded-full bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-900">{uploadedFileName}</p>
                    <p className="text-[11px] text-emerald-700 font-medium">✓ Factura cifrada en bóveda SHA-256</p>
                  </div>
                  <div className="flex justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-xs text-orange-cta font-bold hover:underline"
                    >
                      Tomar otra foto
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-navy-600 font-bold hover:underline"
                    >
                      Subir otro archivo
                    </button>
                  </div>
                </div>
              ) : uploadingFile ? (
                <div className="space-y-2 py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-cta mx-auto" />
                  <p className="text-xs font-semibold text-navy-900">Validando factura ante DIAN...</p>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  <p className="text-xs text-navy-600 font-medium">
                    Arrastra la factura o elige de tu dispositivo
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-cta px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-hover shadow-xs transition-all"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Tomar foto con mi celular</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas-soft px-3.5 py-2.5 text-xs font-semibold text-navy-800 hover:bg-slate-100 transition-all"
                    >
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      <span>Buscar archivo o PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Monto y datos de factura */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-900">
                  Valor Total Facturado (en Pesos Colombianos COP) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="Ej: 180000"
                  value={claimedAmount || ''}
                  onChange={(e) => setClaimedAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="w-full p-3 rounded-xl border border-line bg-canvas-pure text-base font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-orange-cta"
                />
                <div className="flex items-center justify-between text-xs text-navy-500 pt-1">
                  <span>Reembolso estimado:</span>
                  <span className="font-bold text-orange-brand text-sm">
                    {formatCop(claimedAmount)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-navy-800">NIT de la Clínica</label>
                  <input
                    type="text"
                    placeholder="901.234.567-8"
                    value={providerNit}
                    onChange={(e) => setProviderNit(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-line bg-canvas-pure text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-orange-cta"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-navy-800">Nombre de la Clínica</label>
                  <input
                    type="text"
                    placeholder="Clínica Veterinaria Las Palmas"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-line bg-canvas-pure text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-orange-cta"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SOPORTE 2: HISTORIA CLÍNICA / EPICRISIS (OBLIGATORIO) */}
          <div className="p-5 rounded-3xl bg-canvas-soft border-2 border-emerald-200 space-y-4">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">
                    2. Historia Clínica / Epicrisis Veterinaria
                  </h4>
                  <p className="text-[11px] text-navy-500">
                    Informe médico con inicio de síntomas, evolución y diagnóstico
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                Obligatorio
              </span>
            </div>

            {/* Inputs ocultos historia clínica */}
            <input
              ref={clinicalFileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={handleClinicalFileChange}
              className="hidden"
            />
            <input
              ref={clinicalCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleClinicalFileChange}
              className="hidden"
            />

            {/* Dropzone Historia Clínica */}
            <div className="border-2 border-dashed border-emerald-300 rounded-2xl p-4 text-center hover:border-emerald-500 transition-colors bg-canvas-pure">
              {uploadedClinicalDocId ? (
                <div className="space-y-2">
                  <div className="inline-flex p-2.5 rounded-full bg-emerald-100 text-emerald-700">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-900">{uploadedClinicalFileName}</p>
                    <p className="text-[11px] text-emerald-700 font-medium">✓ Historia Clínica verificada por IA</p>
                  </div>
                  <div className="flex justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => clinicalCameraInputRef.current?.click()}
                      className="text-xs text-emerald-700 font-bold hover:underline"
                    >
                      Tomar otra foto
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => clinicalFileInputRef.current?.click()}
                      className="text-xs text-navy-600 font-bold hover:underline"
                    >
                      Subir otro archivo
                    </button>
                  </div>
                </div>
              ) : uploadingClinical ? (
                <div className="space-y-2 py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
                  <p className="text-xs font-semibold text-navy-900">Extrayendo datos clínicos con IA...</p>
                  <p className="text-[10px] text-slate-400">Verificando fechas de síntomas y carencias</p>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  <p className="text-xs text-navy-600 font-medium">
                    Sube la epicrisis, resumen clínico o fórmula médica sellada
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => clinicalCameraInputRef.current?.click()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-all"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Fotografiar Historia Clínica</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => clinicalFileInputRef.current?.click()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas-soft px-3.5 py-2.5 text-xs font-semibold text-navy-800 hover:bg-slate-100 transition-all"
                    >
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      <span>Adjuntar PDF o Documento</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Campos Clínicos Esenciales */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-navy-900">
                    Fecha de inicio de síntomas *
                  </label>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={symptomsStartDate}
                    onChange={(e) => setSymptomsStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-line bg-canvas-pure text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Fecha en que notaste por primera vez el malestar
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-navy-900">
                    Veterinario Tratante / Tarjeta Profesional
                  </label>
                  <input
                    type="text"
                    placeholder="Dr. Carlos Pérez · TP 23456"
                    value={attendingVetName}
                    onChange={(e) => setAttendingVetName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-line bg-canvas-pure text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-navy-900">
                  Diagnóstico Médico Confirmado / Resumen Clínico *
                </label>
                <textarea
                  rows={2}
                  placeholder={`Ej: Gastroenteritis aguda de origen alimentario. Sin signos previos de patología crónica. Microchip verificado.`}
                  value={confirmedDiagnosis}
                  onChange={(e) => setConfirmedDiagnosis(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-line bg-canvas-pure text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-navy-800">
                  Número de Microchip de {petName} (Opcional si figura en la HC)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 900215000123456"
                  value={petMicrochip}
                  onChange={(e) => setPetMicrochip(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-line bg-canvas-pure text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="lg" className="w-1/3 min-h-[50px]" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>Atrás</span>
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="w-2/3 min-h-[50px] shadow-cta"
              onClick={() => {
                if (!requireDocuments) {
                  // Bypass de desarrollo/pruebas activo: autocompletar con datos sintéticos válidos si están vacíos
                  if (claimedAmount <= 0) {
                    setClaimedAmount(150000);
                  }
                  if (!uploadedDocId) {
                    setUploadedDocId('doc_mock_invoice_dev');
                  }
                  if (!uploadedClinicalDocId) {
                    setUploadedClinicalDocId('doc_mock_clinical_dev');
                  }
                  if (!invoiceNumber) {
                    setInvoiceNumber(`FE-TEST-${Math.floor(100000 + Math.random() * 900000)}`);
                  }
                  if (!providerNit) {
                    setProviderNit('901.234.567-8');
                  }
                  if (!providerName) {
                    setProviderName('Clínica Veterinaria Manto Red (Demo)');
                  }
                  if (!dianCufe) {
                    setDianCufe('cufe_bypass_dev_test_998811');
                  }
                  if (!confirmedDiagnosis) {
                    setConfirmedDiagnosis(`Evaluación y atención médica para ${petName} (Bypass de pruebas)`);
                  }
                  if (!attendingVetName) {
                    setAttendingVetName('Dr. Veterinario Manto (TP 99881)');
                  }
                  setError(null);
                  setCurrentStep(3);
                  return;
                }

                // Modo de producción: validación estricta al 100%
                if (claimedAmount <= 0) {
                  setError('Por favor ingresa un monto facturado válido mayor a 0 COP.');
                  return;
                }
                if (!uploadedDocId && !invoiceNumber) {
                  setError('Por favor adjunta la factura electrónica de la clínica veterinaria.');
                  return;
                }
                if (!uploadedClinicalDocId && !confirmedDiagnosis) {
                  setError('La Historia Clínica o Epicrisis es obligatoria para cualquier trámite. Por favor sube el documento o describe el diagnóstico clínico.');
                  return;
                }
                setError(null);
                setCurrentStep(3);
                persistDraft(3);
              }}
            >
              <span>Continuar a Método de Pago</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ================= PASO 3: MÉTODO DE REEMBOLSO ================= */}
      {currentStep === 3 && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-navy-900 tracking-tight">
              ¿Dónde te transferimos el dinero?
            </h3>
            <p className="text-xs text-navy-500 mt-1 leading-relaxed">
              Desembolso inmediato mediante Bre-B (Banco de la República) o tu billetera digital favorita.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PAYOUT_CHANNELS.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => setPayoutChannel(channel.id)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  payoutChannel === channel.id
                    ? 'border-orange-cta bg-orange-subtle/50 ring-2 ring-orange-brand/30 shadow-xs'
                    : 'border-line hover:border-slate-300 bg-canvas-pure'
                }`}
              >
                <div className="flex items-center gap-2">
                  {channel.icon}
                  <div className="text-xs sm:text-sm font-bold text-navy-900">{channel.label}</div>
                </div>
                <div className="text-[11px] text-navy-500 mt-1 leading-tight">{channel.desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-3 bg-canvas-soft p-4 sm:p-5 rounded-2xl border border-line">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-navy-900">
                Tipo de Llave o Identificador para la Transferencia
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'PHONE_NUMBER', label: 'Número de Celular' },
                  { id: 'NATIONAL_ID', label: 'Cédula (C.C.)' },
                  { id: 'EMAIL', label: 'Correo Electrónico' },
                ].map((typeItem) => (
                  <button
                    key={typeItem.id}
                    type="button"
                    onClick={() => setBreBType(typeItem.id as BreBKeyType)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      breBType === typeItem.id
                        ? 'bg-navy-900 text-white shadow-xs'
                        : 'bg-white border border-line text-navy-700 hover:border-slate-300'
                    }`}
                  >
                    {typeItem.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-navy-800">
                {breBType === 'PHONE_NUMBER' && 'Número de Celular (10 dígitos en Colombia)'}
                {breBType === 'NATIONAL_ID' && 'Número de Cédula de Ciudadanía del Titular'}
                {breBType === 'EMAIL' && 'Correo Electrónico registrado en Bre-B / Billetera'}
              </label>
              <input
                type={breBType === 'EMAIL' ? 'email' : 'text'}
                placeholder={breBType === 'PHONE_NUMBER' ? '300 123 4567' : '1.020.304.050'}
                value={breBValue}
                onChange={(e) => setBreBValue(e.target.value)}
                className="w-full p-3 rounded-xl border border-line bg-canvas-pure text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-orange-cta"
              />
              <p className="text-[11px] text-navy-500 pt-0.5">
                La plata caerá directamente en esta cuenta una vez aprobada la liquidación médica.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="lg" className="w-1/3 min-h-[50px]" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>Atrás</span>
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="w-2/3 min-h-[50px] shadow-cta"
              onClick={() => {
                if (!breBValue.trim()) {
                  if (!requireDocuments) {
                    setBreBValue('3001234567');
                    setError(null);
                    setCurrentStep(4);
                    return;
                  }
                  setError('Por favor indica tu número de celular, cédula o cuenta para desembolsar el dinero.');
                  return;
                }
                setError(null);
                setCurrentStep(4);
                persistDraft(4, { payoutChannel, breBType, breBValue });
              }}
            >
              <span>Revisar Reclamación</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ================= PASO 4: CONFIRMACIÓN Y ENVÍO ================= */}
      {currentStep === 4 && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-navy-900 tracking-tight">
              Revisa y Radica tu Reembolso
            </h3>
            <p className="text-xs text-navy-500 mt-1 leading-relaxed">
              Verifica los datos antes de que Sué y el motor de Triage procesen tu liquidación.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-canvas-soft border border-line space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2.5 border-b border-line">
              <span className="text-navy-500 font-medium">Mascota Asegurada</span>
              <span className="font-bold text-navy-900 text-sm">{petName}</span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-line">
              <span className="text-navy-500 font-medium">Póliza Activa</span>
              <span className="font-mono text-navy-800">{policyNumber}</span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-line">
              <span className="text-navy-500 font-medium">Tipo de Evento</span>
              <span className="font-semibold text-navy-900">
                {INCIDENT_OPTIONS.find((o) => o.id === incidentType)?.label}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-line">
              <span className="text-navy-500 font-medium">Valor Total Facturado</span>
              <span className="font-bold text-navy-900 text-sm tabular-nums">
                {formatCop(claimedAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-line">
              <span className="text-navy-500 font-medium">Canal de Dispersión</span>
              <span className="font-bold text-emerald-700">
                {payoutChannel} ({breBValue})
              </span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-line">
              <span className="text-navy-500 font-medium">Historia Clínica / Diagnóstico</span>
              <span className="font-semibold text-emerald-800 text-right truncate max-w-[220px]">
                {confirmedDiagnosis || uploadedClinicalFileName || 'Adjunta en bóveda'}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-line">
              <span className="text-navy-500 font-medium">Inicio de Síntomas</span>
              <span className="font-semibold text-navy-800">{symptomsStartDate}</span>
            </div>
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-navy-500 font-medium">Tiempo de Resolución Estimado</span>
              <span className="font-bold text-navy-900">
                {claimedAmount <= 200000 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <span>Fast-Track Bre-B (3 a 5 min)</span>
                  </span>
                ) : (
                  <span className="text-blue-800">Autenticación Pericial Express (&lt; 24h hábiles)</span>
                )}
              </span>
            </div>
          </div>

          <div className="p-4 bg-orange-subtle/40 border border-orange-brand/20 rounded-2xl text-xs text-navy-900 flex items-start gap-3">
            <HeartHandshake className="w-5 h-5 text-orange-brand shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Al radicar, declaras bajo la gravedad de juramento que la factura DIAN y la atención médica corresponden a un evento real de <strong>{petName}</strong> en la clínica veterinaria.
            </p>
          </div>

          {/* Consentimiento Habeas Data (Ley 1581 de 2012) */}
          <div className="p-3.5 bg-slate-50 border border-line rounded-2xl flex items-start gap-3">
            <input
              type="checkbox"
              id="habeasDataConsent"
              checked={habeasDataConsent}
              onChange={(e) => setHabeasDataConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-cta focus:ring-orange-brand cursor-pointer"
            />
            <label htmlFor="habeasDataConsent" className="text-xs text-navy-700 leading-relaxed cursor-pointer select-none">
              Autorizo el tratamiento de mis datos personales y soportes veterinarios para la evaluación, liquidación y auditoría de este reembolso, conforme a la <strong>Ley 1581 de 2012</strong> (Habeas Data) y la política de privacidad de Manto.
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="lg" className="w-1/3 min-h-[52px]" onClick={() => setCurrentStep(3)}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>Atrás</span>
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="w-2/3 min-h-[52px] shadow-cta"
              disabled={submitting}
              onClick={handleSubmit}
            >
              <span>{submitting ? 'Radicando...' : 'Radicar mi reembolso'}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimsStepper;
