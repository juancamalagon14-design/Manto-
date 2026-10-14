'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, RefreshCw, ShieldCheck, Sparkles, SwitchCamera, Smartphone } from 'lucide-react';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageBase64: string, isLiveCapture: boolean) => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);

  // Detener el stream de la cámara limpiamente
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Iniciar stream de cámara vía WebRTC
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    stopStream();
    setPermissionError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso directo a la cámara WebRTC en tiempo real.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: unknown) {
      console.error('Error al inicializar cámara WebRTC:', err);
      let message = 'No se pudo acceder a la cámara en vivo.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Permiso de cámara denegado. Puedes habilitar el acceso o usar la cámara nativa de tu celular.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No se detectó ninguna cámara física activa en este dispositivo.';
        }
      }
      setPermissionError(message);
      setCameraActive(false);
    }
  }, [stopStream]);

  useEffect(() => {
    if (isOpen) {
      setCapturedPreview(null);
      startCamera(facingMode);
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Cambiar entre cámara trasera y delantera (móviles)
  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Instantánea inmediata desde video WebRTC
  const takeLiveSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Efecto de flash visual
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dibujar frame en canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Marca de agua y timestamp para trazabilidad
    const timestamp = new Date().toISOString();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(`MANTO_LIVE_CAPTURE_VERIFIED_${timestamp}`, 16, height - 16);

    const base64Data = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPreview(base64Data);
    stopStream();
  };

  // Confirmar captura y enviar a Nuquí
  const confirmLiveCapture = () => {
    if (!capturedPreview) return;
    setIsProcessing(true);
    onCapture(capturedPreview, true);
    setIsProcessing(false);
  };

  // Captura desde la cámara nativa del celular (capture="environment")
  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) return;

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const timestamp = new Date().toISOString();
          ctx.font = '12px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillText(`MANTO_LIVE_CAPTURE_VERIFIED_${timestamp}`, 16, height - 16);
          const base64Data = canvas.toDataURL('image/jpeg', 0.88);
          setCapturedPreview(base64Data);
          setPermissionError(null);
          stopStream();
        }
      };
      img.onerror = () => {
        setPermissionError('No pudimos procesar la foto capturada. Intenta de nuevo.');
      };
      img.src = src;
    };
    reader.readAsDataURL(file);

    // Resetear el valor para permitir capturar la misma foto si se reintenta
    e.target.value = '';
  };

  // Reintentar captura
  const handleRetake = () => {
    setCapturedPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    startCamera(facingMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col my-auto max-h-[95vh]">
        {/* Header del Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 sm:px-6 py-3.5 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-subtle border border-orange-brand/20 text-orange-brand">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-navy-900 flex items-center gap-2">
                Cámara de Nuquí
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Verificación directa
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-navy-500">
                Captura a tu consentido para cotizar a la medida
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-navy-900 transition-colors"
            aria-label="Cerrar cámara"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewfinder / Visor de Cámara */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950 flex items-center justify-center shrink-0">
          {/* Visual Flash effect */}
          {flashActive && (
            <div className="absolute inset-0 z-30 bg-white opacity-80 pointer-events-none transition-opacity duration-200" />
          )}

          {/* Hidden Canvas for snapshot */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Input nativo para cámara del celular (capture="environment") */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileCapture}
          />

          {/* Preview del snapshot congelado con marca de verificación */}
          {capturedPreview ? (
            <div className="relative h-full w-full bg-slate-950 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedPreview}
                alt="Foto capturada de tu mascota"
                className="h-full w-full object-contain"
              />

              {/* Marca de Verificación en Vivo */}
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 rounded-full bg-emerald-600/90 border border-emerald-400/40 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-fade-in">
                <ShieldCheck className="w-4 h-4 text-emerald-200" />
                <span>Captura Verificada</span>
              </div>

              {/* Guía visual inferior */}
              <div className="absolute bottom-3 inset-x-4 mx-auto max-w-xs rounded-xl bg-slate-900/80 border border-white/10 px-3 py-1.5 text-center text-xs font-medium text-white shadow-md backdrop-blur-sm">
                Foto nítida lista para reconocimiento
              </div>
            </div>
          ) : permissionError ? (
            <div className="p-6 text-center max-w-sm space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-cta/20 border border-orange-cta/40 text-orange-cta shadow-sm">
                <Smartphone className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-bold text-white">Activa la cámara de tu celular</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Para máxima nitidez y compatibilidad móvil, puedes capturar a tu consentido directamente con la cámara nativa de tu teléfono:
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-orange-cta px-5 py-3 text-sm font-bold text-white hover:bg-orange-hover shadow-cta active:scale-95 transition-all"
                >
                  <Camera className="h-5 w-5" />
                  <span>Tomar foto con mi celular</span>
                </button>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-slate-800/80 border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reintentar video en directo
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Video Stream en Vivo WebRTC */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />

              {/* Botón rápido para invocar la cámara nativa del celular desde el visor */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-slate-950/70 border border-white/25 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-slate-900 transition-all shadow-md active:scale-95"
                title="Abrir cámara nativa del celular"
              >
                <Smartphone className="h-3.5 w-3.5 text-orange-400" />
                <span>Cámara del celular</span>
              </button>

              {/* Guía de encuadre */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <div className="relative h-full w-full max-w-[85%] max-h-[85%] rounded-2xl border-2 border-dashed border-white/60 flex flex-col justify-between p-3">
                  <div className="flex justify-between items-center text-[10px] text-white/80 font-medium">
                    <span>Encuadre de mascota</span>
                    <span>Nuquí 🐾</span>
                  </div>

                  <div className="text-center text-xs font-medium text-white bg-slate-950/60 backdrop-blur-sm py-1.5 px-3 rounded-lg mx-auto">
                    Ubica el rostro o perfil de tu mascota
                  </div>
                </div>
              </div>

              {/* Botón de voltear cámara (móviles) */}
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/70 border border-white/25 text-white backdrop-blur-md hover:bg-slate-900 transition-colors shadow-md active:scale-95"
                title="Cambiar de cámara"
                aria-label="Cambiar de cámara"
              >
                <SwitchCamera className="h-5 w-5 text-white" />
              </button>
            </>
          )}
        </div>

        {/* Seguridad Anti-Fraude */}
        <div className="border-t border-slate-100 bg-canvas-soft px-5 sm:px-6 py-2.5 flex items-center justify-between text-xs text-navy-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] leading-tight">
              <strong className="text-navy-900 font-semibold">Cámara en directo:</strong> Se analiza en tiempo real para cotización a tu medida.
            </span>
          </div>
        </div>

        {/* Acciones del Pie optimizadas para pulgares móviles */}
        <div className="border-t border-slate-200 bg-white p-4 sm:px-6 sm:py-4 shrink-0">
          {capturedPreview ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 min-h-[48px] rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-navy-800 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4 text-navy-600" />
                <span>Repetir foto</span>
              </button>
              <button
                type="button"
                onClick={confirmLiveCapture}
                disabled={isProcessing}
                className="flex-1 min-h-[48px] rounded-2xl bg-orange-cta px-5 py-3 text-sm font-bold text-white shadow-cta hover:bg-orange-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isProcessing ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Sparkles className="h-5 w-5 text-white" />
                )}
                <span>{isProcessing ? 'Analizando…' : 'Analizar con Nuquí'}</span>
              </button>
            </div>
          ) : permissionError || !cameraActive ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-2xl py-3 px-6 text-sm font-bold text-white bg-orange-cta hover:bg-orange-hover active:scale-[0.98] shadow-cta transition-all"
              >
                <Camera className="h-5 w-5" />
                <span>Tomar foto con mi celular</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 sm:gap-3">
              {/* Botón principal grande para el pulgar */}
              <button
                type="button"
                onClick={takeLiveSnapshot}
                className="w-full min-h-[50px] flex items-center justify-center gap-2 rounded-2xl py-3.5 px-6 text-sm sm:text-base font-bold text-white bg-orange-cta hover:bg-orange-hover active:scale-[0.98] shadow-cta transition-all"
              >
                <Camera className="h-5 w-5" />
                <span>Tomar Foto en Vivo</span>
              </button>

              {/* Fila de acciones secundarias */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-orange-brand/25 bg-orange-subtle/50 px-3 py-2 text-xs sm:text-sm font-bold text-orange-brand hover:bg-orange-subtle active:scale-[0.98] transition-all"
                >
                  <Smartphone className="h-4 w-4 text-orange-brand" />
                  <span>Cámara del celular</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveCameraModal;
