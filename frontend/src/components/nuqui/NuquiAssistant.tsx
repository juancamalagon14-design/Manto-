'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, MessageSquare, Send, AlertTriangle, AlertCircle, RefreshCw, ChevronDown, ChevronUp, ShieldCheck, Sparkles, Search, Check, CheckSquare, PawPrint, X } from 'lucide-react';
import { api, MantoApiError } from '@/lib/api';
import {
  AddonKey,
  AddonOption,
  BreedCatalogEntry,
  City,
  DeductibleOption,
  Gender,
  PricingCalculationInput,
  PricingCalculationResult,
  SizeCategory,
  Species,
} from '@/types/pricing';
import { QuoteSnapshot } from '@/types/policy';
import { AGE_DROPDOWN_OPTIONS } from '@/lib/constants';
import { formatCop, formatMonthsToAgeString, cn } from '@/lib/utils';
import { Button, ChatBubble, TypingIndicator, FilterableDropdown, DropdownOption } from '@/components/ui';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import DeductibleSelector from '@/components/pricing/DeductibleSelector';
import LiveCameraModal from './LiveCameraModal';
import CheckoutDrawer from '../checkout/CheckoutDrawer';

/**
 * Nuquí — el cotizador de Manto.
 *
 * Es el único cotizador del producto: no hay otro chat, ni formulario, ni
 * calculadora paralela. Todo el flujo de cotización vive aquí.
 *
 * Secuencia acordada con el cliente:
 *   foto o chat → nombre → especie → ciudad → sexo → edad → raza → cálculo → plan base → opcionales
 *
 * Dos reglas que este componente no negocia:
 *   1. Ningún precio se calcula en el navegador. Todas las cifras que ve el
 *      cliente vienen de POST /v1/pricing/calculate-quote.
 *   2. Ningún catálogo se duplica aquí. Razas y opcionales se piden al backend.
 *
 * Pendientes conocidos, deliberadamente fuera de este componente:
 *   · Cuenta y verificación por correo (pasos 1 y 2): esperan a Entra External ID.
 *   · Google Places para la dirección: hoy se eligen las ciudades del catálogo tarifario.
 *   · Límite anual elegible: exige un factor actuarial por límite que aún no existe.
 */

type Paso =
  | 'INICIO'
  | 'REINTENTO_FOTO'
  | 'CONFIRMAR_RAZA_FOTO'
  | 'MASCOTAS'
  | 'NOMBRE'
  | 'ESPECIE'
  | 'CIUDAD'
  | 'SEXO'
  | 'EDAD'
  | 'RAZA'
  | 'CALCULANDO'
  | 'PLAN'
  | 'OPCIONALES';

interface Turno {
  id: string;
  de: 'nuqui' | 'yo';
  texto: string;
  imagen?: string;
}

export interface PerfilMascota {
  nombre: string;
  especie: Species | null;
  ciudad: City | null;
  sexo: Gender | null;
  meses: number | null;
  razaCodigo: string | null;
  razaNombre: string;
  tamano?: SizeCategory;
  fotoPreview?: string;
}

const CIUDADES: { id: City; label: string }[] = [
  { id: 'BOGOTA', label: 'Bogotá D.C.' },
  { id: 'MEDELLIN', label: 'Medellín y Valle de Aburrá' },
  { id: 'CALI', label: 'Cali' },
  { id: 'OTHER', label: 'Otra ciudad de Colombia' },
];

/** Etapas del cálculo. Describen qué se está mirando, sin fingir precisión numérica. */
const ETAPAS_CALCULO = [
  'Analizando raza y contextura…',
  'Cruzando edad con la tabla de siniestralidad…',
  'Ajustando por zona de atención veterinaria…',
  'Armando el plan base…',
];

/** Rango asegurable de nuevo ingreso, en meses. */
const EDAD_MIN_MESES = 2;
const EDAD_MAX_MESES = 144;

/** Semanas por mes calendario promedio (365,25 / 7 / 12). */
const SEMANAS_POR_MES = 4.348;

/**
 * Interpreta lo que la persona escribe en el campo de edad y devuelve meses.
 *
 * Acepta "3", "3 años", "8 meses", "8 semanas", "2 años y 6 meses",
 * "año y medio", "medio año". Devuelve null cuando no entiende o cuando la
 * edad queda fuera del rango asegurable de nuevo ingreso (2 a 144 meses).
 *
 * Dos cosas que este parser sí hace, y antes no:
 *
 *   · Suma años y meses cuando vienen juntos. "2 años y 6 meses" son 30 meses.
 *     Antes bastaba con que el texto contuviera "mes" para que el número de
 *     años se leyera como meses: "12 años y 3 meses" tarifaba un cachorro.
 *   · Lee semanas, que es como se habla de un cachorro recién llegado.
 *     "8 semanas" son 2 meses, justo el mínimo asegurable; "6 semanas" quedan
 *     por debajo y se rechazan.
 *
 * Normaliza quitando todas las marcas diacríticas, la de la ñ incluida, y
 * compara contra "ano". Conservarla obligaba a escribir la clase de caracteres
 * en dos formas (precompuesta y descompuesta) y ninguna coincidía con la otra.
 */
export function interpretarEdad(texto: string): number | null {
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // año → ano
    .trim();
  if (!t) return null;

  // Un signo menos delante de la cifra es un error de digitación, no una edad.
  if (/-\s*\d/.test(t)) return null;

  const dentroDeRango = (meses: number): number | null =>
    meses >= EDAD_MIN_MESES && meses <= EDAD_MAX_MESES ? meses : null;

  // "medio año" va antes que todo: si no, el "año" sin cifra vale uno y se
  // suma el medio, dando 18 meses donde la persona dijo 6.
  if (/\bmedio\s+anos?\b/.test(t)) return dentroDeRango(6);

  const aNumero = (bruto: string): number | null => {
    const v = parseFloat(bruto.replace(',', '.'));
    return isNaN(v) || v < 0 ? null : v;
  };

  /**
   * Rangos: "entre 2 y 3 años", "7 u 8 años", "3 a 4 años".
   *
   * Se toma el extremo BAJO. Antes se leía el número pegado a la unidad, es
   * decir el alto, y eso es adverso al cliente: se le tarifaba la edad más
   * cara de las dos que dijo.
   */
  const rango = t.match(/(\d+(?:[.,]\d+)?)\s*(?:y|u|o|a|-|hasta)\s+(\d+(?:[.,]\d+)?)\s*(anos?|mes(?:es)?|semanas?)\b/);
  if (rango && !/medio/.test(t)) {
    const bajo = aNumero(rango[1]);
    if (bajo === null) return null;
    const unidad = rango[3];
    if (unidad.startsWith('mes')) return dentroDeRango(Math.round(bajo));
    if (unidad.startsWith('semana')) return dentroDeRango(Math.round(bajo / SEMANAS_POR_MES));
    return dentroDeRango(Math.round(bajo * 12));
  }

  const numeroAntesDe = (unidad: string): number | null => {
    const m = t.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unidad}`));
    return m ? aNumero(m[1]) : null;
  };

  const anios = numeroAntesDe('anos?\\b');
  const mesesSueltos = numeroAntesDe('mes');
  const semanas = numeroAntesDe('semana');

  /**
   * "año" o "años" sin cifra delante vale uno.
   *
   * "año y 6 meses" es la forma normal de decir año y medio en Colombia, y sin
   * esto la parte de años se perdía: se leían solo los 6 meses y se tarifaba
   * un cachorro de 6 meses en lugar de una mascota de 18.
   */
  const aniosImplicito = anios === null && /(^|\s)anos?\b/.test(t) ? 1 : 0;

  // "medio": medio año, año y medio, dos años y medio.
  const mediaAnualidad =
    /\bmedio\b/.test(t) && mesesSueltos === null && semanas === null ? 6 : 0;
  if (anios !== null || mesesSueltos !== null || semanas !== null || aniosImplicito) {
    const total = Math.round(
      (anios ?? aniosImplicito) * 12 +
        (mesesSueltos ?? 0) +
        (semanas ?? 0) / SEMANAS_POR_MES +
        mediaAnualidad,
    );
    return dentroDeRango(total);
  }

  // Sin unidad: un número solo se lee como años.
  const suelto = t.match(/(\d+(?:[.,]\d+)?)/);
  if (!suelto) return null;
  const valor = aNumero(suelto[1]);
  if (valor === null) return null;
  return dentroDeRango(Math.round(valor * 12));
}

export const NuquiAssistant: React.FC = () => {
  const [paso, setPaso] = useState<Paso>('MASCOTAS');
  const [sessionId, setSessionId] = useState<string>('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cantidad de mascotas a asegurar (1 o 2+)
  const [mascotasDeclaradas, setMascotasDeclaradas] = useState(1);
  const [mascotaActualIndex, setMascotaActualIndex] = useState(0); // 0 = Primera mascota, 1 = Segunda mascota
  const [mascotasGuardadas, setMascotasGuardadas] = useState<PerfilMascota[]>([]);

  // Datos de la mascota en captura actual
  const [nombre, setNombre] = useState('');
  const [especie, setEspecie] = useState<Species | null>(null);
  const [ciudad, setCiudad] = useState<City | null>(null);
  const [sexo, setSexo] = useState<Gender | null>(null);
  const [meses, setMeses] = useState<number | null>(null);
  const [razaCodigo, setRazaCodigo] = useState<string | null>(null);
  const [razaNombre, setRazaNombre] = useState('');
  const [tamano, setTamano] = useState<SizeCategory | undefined>(undefined);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [razaDetectadaCandidata, setRazaDetectadaCandidata] = useState<{
    code: string;
    name: string;
    species: Species;
    sizeCategory?: SizeCategory;
  } | null>(null);
  const [razaConfirmadaPorFoto, setRazaConfirmadaPorFoto] = useState(false);

  // Selección de mascotas a facturar/emitir (por defecto [0, 1] si son 2)
  const [mascotasFacturacion, setMascotasFacturacion] = useState<number[]>([0, 1]);
  const [checkoutBreakdown, setCheckoutBreakdown] = useState<{ name: string; amountCop: number }[]>([]);
  const [checkoutPetName, setCheckoutPetName] = useState<string>('');
  const [checkoutTotalAmount, setCheckoutTotalAmount] = useState<number>(0);

  /** Mascotas que esta operación cotiza de verdad (depende de cuántas están seleccionadas para facturar). */
  const mascotasCotizadas = mascotasDeclaradas >= 2 && mascotasFacturacion.length >= 2 ? 2 : 1;

  // Visualización de planes en multi-mascota
  const [mascotaActivaTab, setMascotaActivaTab] = useState<number>(0);
  const [planMascota1, setPlanMascota1] = useState<PricingCalculationResult | null>(null);
  const [planMascota2, setPlanMascota2] = useState<PricingCalculationResult | null>(null);

  // Entradas
  const [texto, setTexto] = useState('');
  const [etapaCalculo, setEtapaCalculo] = useState(0);
  const [reintentoCalculo, setReintentoCalculo] = useState(0);

  // Resultado
  const [plan, setPlan] = useState<PricingCalculationResult | null>(null);
  const [addons, setAddons] = useState<AddonKey[]>([]);
  const [recalculando, setRecalculando] = useState(false);
  const [errorRecalculo, setErrorRecalculo] = useState<string | null>(null);

  const primaTotalFacturacion = useMemo(() => {
    if (mascotasDeclaradas < 2 || mascotasGuardadas.length < 2) {
      return plan?.totalMonthlyPremiumCop ?? 0;
    }
    let total = 0;
    if (mascotasFacturacion.includes(0)) {
      total += planMascota1?.totalMonthlyPremiumCop ?? 0;
    }
    if (mascotasFacturacion.includes(1)) {
      total += planMascota2?.totalMonthlyPremiumCop ?? 0;
    }
    return total;
  }, [mascotasDeclaradas, mascotasGuardadas, mascotasFacturacion, plan, planMascota1, planMascota2]);

  /** Alterna la inclusión de una mascota en la facturación asegurando al menos una seleccionada. */
  const toggleMascotaFacturacion = useCallback((index: number) => {
    setMascotasFacturacion((prev) => {
      if (prev.includes(index)) {
        if (prev.length <= 1) {
          return prev; // No deseleccionar si es la única
        }
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index].sort((a, b) => a - b);
      }
    });
  }, []);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [intentosFoto, setIntentosFoto] = useState(0);
  const MAX_INTENTOS_FOTO = 3;

  // Catálogos servidos por el backend. Única fuente de verdad.
  const [razas, setRazas] = useState<BreedCatalogEntry[]>([]);
  const [opcionales, setOpcionales] = useState<AddonOption[]>([]);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [reintentoCatalogo, setReintentoCatalogo] = useState(0);

  // Checkout
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);

  /**
   * La cotización que el servidor emitió. El checkout cobra ESTA cifra.
   *
   * Antes el cajón recibía `plan.totalMonthlyPremiumCop` como prop viva, así
   * que un recálculo diferido podía cambiar el precio mostrado después de
   * congelar la cotización: la pantalla decía $84.690 y la cotización emitida
   * era de $59.790, sin el opcional que el cliente acababa de marcar.
   */
  const [cotizacion, setCotizacion] = useState<QuoteSnapshot | null>(null);

  /**
   * Cerrojo síncrono contra el doble envío. `emitiendo` es estado de React y
   * solo deshabilita el botón en el render siguiente: quedaba una ventana de
   * un frame en la que dos clics emitían dos cotizaciones.
   */
  const emitiendoRef = useRef(false);

  const finRef = useRef<HTMLDivElement | null>(null);
  const [deductible, setDeductible] = useState<DeductibleOption>(0.15);
  const [mostrarDetalleBase, setMostrarDetalleBase] = useState(false);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turnos, escribiendo, paso]);

  const decir = useCallback((texto: string, de: 'nuqui' | 'yo' = 'nuqui', imagen?: string) => {
    setTurnos((t) => [...t, { id: `${Date.now()}-${Math.random()}`, de, texto, imagen }]);
  }, []);

  /** Pausa con indicador de escritura, para que la conversación respire. */
  const pensar = useCallback(async (ms = 700) => {
    setEscribiendo(true);
    await new Promise((r) => setTimeout(r, ms));
    setEscribiendo(false);
  }, []);

  // Apertura de la sesión conversacional
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const init = await api.startChat();
        if (!vivo) return;
        setSessionId(init.session.sessionId);
        // Saludo oficial desde el backend
        decir(init.welcomeMessage.text);
        await pensar(800);
        if (!vivo) return;
        decir('¿Cuántos peluditos quieres asegurar?');
        setPaso('MASCOTAS');
      } catch (err) {
        if (!vivo) return;
        setError(
          err instanceof MantoApiError && err.isUnreachable
            ? 'No pudimos conectarnos con Manto. Revisa tu conexión e intenta de nuevo.'
            : 'No pudimos iniciar la cotización. Intenta de nuevo en unos segundos.',
        );
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Catálogos de razas y opcionales. Se piden al motor, nunca se copian aquí.
   * Si fallan, la interfaz ofrece reintentar en vez de quedarse sin salida.
   */
  useEffect(() => {
    let vivo = true;
    setCargandoCatalogo(true);
    (async () => {
      try {
        const [catRazas, catOpcionales] = await Promise.all([api.getBreeds(), api.getAddons()]);
        if (!vivo) return;
        setRazas(catRazas);
        setOpcionales(catOpcionales);
        setErrorCatalogo(null);
      } catch (err) {
        if (!vivo) return;
        setErrorCatalogo(
          err instanceof MantoApiError && err.isUnreachable
            ? 'No pudimos cargar el catálogo porque no hay conexión con Manto.'
            : 'No pudimos cargar el catálogo de razas y coberturas.',
        );
      } finally {
        if (vivo) setCargandoCatalogo(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [reintentoCatalogo]);

  // ---- Transiciones ----

  const irANombre = useCallback(async () => {
    await pensar();
    if (mascotasDeclaradas > 1) {
      decir(
        mascotaActualIndex === 0
          ? '¿Cómo se llama tu primer peludito?'
          : '¿Cómo se llama tu segundo peludito?',
      );
    } else {
      decir('¿Cómo se llama?');
    }
    setPaso('NOMBRE');
  }, [decir, pensar, mascotasDeclaradas, mascotaActualIndex]);

  const responderMascotas = async (cantidad: number) => {
    setMascotasDeclaradas(cantidad);
    setMascotaActualIndex(0);
    setMascotasGuardadas([]);
    decir(
      cantidad === 1
        ? '1 peludito | Protección individual completa'
        : '2 o más peluditos | 5% de descuento en cada póliza',
      'yo',
    );
    await pensar(800);
    if (cantidad === 1) {
      decir('¿Prefieres mandarme una foto para reconocerla, o conversamos?');
    } else {
      decir(
        '¡Buenísimo! Tienes un 5% de descuento garantizado en cada póliza. Empecemos con tu primer peludito: ¿prefieres mandarme una foto para reconocerla, o conversamos?',
      );
    }
    setPaso('INICIO');
  };

  const responderSeguirPorChat = async () => {
    decir('Seguir por chat', 'yo');
    await pensar(600);
    decir('¡Perfecto! Continuemos por aquí.');
    await irANombre();
  };

  const responderConversemos = async () => {
    decir('Conversemos', 'yo');
    await irANombre();
  };

  const tomarFoto = async (imagenBase64: string) => {
    setCamaraAbierta(false);
    setFotoPreview(imagenBase64);
    // Previsualización limpia de la foto recién tomada, SIN el texto "Foto enviada"
    decir('', 'yo', imagenBase64);
    setEscribiendo(true);
    const siguienteIntento = intentosFoto + 1;
    setIntentosFoto(siguienteIntento);

    try {
      const res = await api.sendLivePhoto(sessionId, { imageBase64: imagenBase64, isLiveCapture: true });
      const slots = res.session.slots;
      const metadata = res.reply.metadata;

      if (slots.species) setEspecie(slots.species);

      const nombreRazaDetectada = slots.breedName || metadata?.detectedBreed;
      const codigoRazaDetectada = slots.breedCode || 'CRIOLLO_MESTIZO';

      if (nombreRazaDetectada) {
        setRazaDetectadaCandidata({
          code: codigoRazaDetectada,
          name: nombreRazaDetectada,
          species: slots.species ?? 'CANINE',
          sizeCategory: slots.sizeCategory,
        });
        setEscribiendo(false);
        await pensar(400);
        decir(`¡Qué linda foto! 📸 Veo que es un **${nombreRazaDetectada}**. ¿Es correcto?`);
        setPaso('CONFIRMAR_RAZA_FOTO');
      } else {
        setEscribiendo(false);
        if (siguienteIntento < MAX_INTENTOS_FOTO) {
          decir(
            `No logré distinguir con total claridad los rasgos de tu peludo en esta toma (intento ${siguienteIntento} de ${MAX_INTENTOS_FOTO}). ¿Intentamos otra foto con mejor luz o prefieres que sigamos por chat?`,
          );
          setPaso('REINTENTO_FOTO');
        } else {
          decir(
            '¡Tranqui, no te preocupes! Para no hacerte perder tiempo con la cámara, sigamos por el chat y te hago unas preguntas muy sencillas.',
          );
          await irANombre();
        }
      }
    } catch (_err: unknown) {
      setEscribiendo(false);
      if (siguienteIntento < MAX_INTENTOS_FOTO) {
        decir(
          `Tuvimos un pequeño inconveniente al analizar la foto (intento ${siguienteIntento} de ${MAX_INTENTOS_FOTO}). ¿Intentamos tomar otra foto o seguimos por chat?`,
        );
        setPaso('REINTENTO_FOTO');
      } else {
        decir(
          '¡Tranqui, no te preocupes! Para no hacerte perder tiempo con la cámara, sigamos por el chat y te hago unas preguntas muy sencillas.',
        );
        await irANombre();
      }
    }
  };

  const confirmarRazaFoto = async () => {
    if (!razaDetectadaCandidata) return;
    decir(`Sí, es ${razaDetectadaCandidata.name}`, 'yo');
    setRazaCodigo(razaDetectadaCandidata.code);
    setRazaNombre(razaDetectadaCandidata.name);
    setEspecie(razaDetectadaCandidata.species);
    if (razaDetectadaCandidata.sizeCategory) {
      setTamano(razaDetectadaCandidata.sizeCategory);
    }
    setRazaConfirmadaPorFoto(true);
    await pensar(500);
    decir(`¡Listo, raza confirmada: ${razaDetectadaCandidata.name}! Continuemos con sus datos.`);
    await irANombre();
  };

  const rechazarRazaFoto = async () => {
    decir('No, es otra raza', 'yo');
    setRazaCodigo(null);
    setRazaNombre('');
    setRazaConfirmadaPorFoto(false);
    await pensar(500);
    decir('¡Entendido! No te preocupes, más adelante te pregunto cuál es su raza.');
    await irANombre();
  };

  const responderNombre = async (valor: string) => {
    const limpio = valor.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!limpio) return;
    setNombre(limpio);
    decir(limpio, 'yo');
    setTexto('');
    await pensar();
    if (especie) {
      // Vino por foto: la especie ya se conoce.
      decir(`Mucho gusto, ${limpio}. ¿En qué ciudad viven?`);
      setPaso('CIUDAD');
    } else {
      decir(`Mucho gusto, ${limpio}. ¿Es perro o gato?`);
      setPaso('ESPECIE');
    }
  };

  const responderEspecie = async (valor: Species) => {
    setEspecie(valor);
    decir(valor === 'CANINE' ? 'Perro' : 'Gato', 'yo');
    await pensar();
    decir(`¿En qué ciudad viven ${nombre} y tú?`);
    setPaso('CIUDAD');
  };

  const responderCiudad = async (valor: City) => {
    setCiudad(valor);
    decir(CIUDADES.find((c) => c.id === valor)?.label ?? valor, 'yo');
    await pensar();
    decir(`¿${nombre} es niño o niña?`);
    setPaso('SEXO');
  };

  const responderSexo = async (valor: Gender) => {
    setSexo(valor);
    decir(valor === 'MALE' ? 'Niño' : 'Niña', 'yo');
    await pensar();
    decir(`¿Cuántos años tiene ${nombre}? Escríbelo como quieras, o elige de la lista.`);
    setPaso('EDAD');
  };

  const responderEdad = async (valorMeses: number, etiqueta: string) => {
    setMeses(valorMeses);
    decir(etiqueta, 'yo');
    setTexto('');
    await pensar();

    if (razaConfirmadaPorFoto && razaCodigo) {
      // Si la persona ya confirmó la raza detectada en la foto (pregunta de Sí / No), NO se vuelve a preguntar
      decir(`Ya tenemos confirmada la raza de ${nombre} (${razaNombre}). ¡Procedo a calcular su plan!`);
      await pensar(500);
      await finalizarRegistroMascota(razaCodigo, razaNombre, valorMeses);
    } else {
      // Si no tomó foto o respondió "No, es otra raza", se le pregunta la raza normalmente
      decir('¿De qué raza es? Escribe y te voy mostrando.');
      setPaso('RAZA');
    }
  };

  const finalizarRegistroMascota = async (codigo: string, nombreRazaR: string, edadMeses?: number) => {
    const encontrada = razas.find((b) => b.code === codigo);
    const espFinal = encontrada?.species ?? especie ?? 'CANINE';
    const tamFinal = encontrada?.typicalSize ?? tamano;
    const mesesFinal = edadMeses ?? meses ?? 12;

    const petCompletado: PerfilMascota = {
      nombre,
      especie: espFinal,
      ciudad: ciudad ?? 'BOGOTA',
      sexo: sexo ?? 'MALE',
      meses: mesesFinal,
      razaCodigo: codigo,
      razaNombre: nombreRazaR,
      tamano: tamFinal,
      fotoPreview: fotoPreview ?? undefined,
    };

    if (mascotasDeclaradas >= 2 && mascotaActualIndex === 0) {
      // Guardar primera mascota y pasar a la segunda
      setMascotasGuardadas([petCompletado]);
      setMascotaActualIndex(1);

      // Resetear campos para la segunda mascota conservando la ciudad
      setNombre('');
      setEspecie(null);
      setSexo(null);
      setMeses(null);
      setRazaCodigo(null);
      setRazaNombre('');
      setTamano(undefined);
      setFotoPreview(null);
      setIntentosFoto(0);
      setRazaDetectadaCandidata(null);
      setRazaConfirmadaPorFoto(false);

      await pensar(800);
      decir(`¡Listo los datos de ${nombre}! Ahora vamos con tu segundo peludito.`);
      await pensar(700);
      decir('¿Prefieres mandarme una foto para reconocerla, o conversamos?');
      setPaso('INICIO');
    } else {
      // Completada la última mascota (sea 1 o 2)
      if (mascotasDeclaradas >= 2) {
        const todas = [...mascotasGuardadas, petCompletado];
        setMascotasGuardadas(todas);
        await pensar(800);
        decir(
          `¡Excelente! Ya tengo los datos de ${mascotasGuardadas[0]?.nombre} y ${nombre}. Estoy calculando sus planes con el 5% de descuento por múltiples mascotas…`,
        );
      } else {
        setMascotasGuardadas([petCompletado]);
      }

      setReintentoCalculo((n) => n + 1);
      setPaso('CALCULANDO');
    }
  };

  const responderRaza = async (codigo: string, nombreRazaR: string) => {
    setRazaCodigo(codigo);
    setRazaNombre(nombreRazaR);
    decir(nombreRazaR, 'yo');
    setTexto('');
    await pensar(400);
    await finalizarRegistroMascota(codigo, nombreRazaR);
  };

  // Cálculo del plan base, con etapas visibles
  useEffect(() => {
    if (paso !== 'CALCULANDO') return;

    let vivo = true;
    setEtapaCalculo(0);

    const reloj = setInterval(() => {
      setEtapaCalculo((i) => Math.min(i + 1, ETAPAS_CALCULO.length - 1));
    }, 850);

    const calcular = async () => {
      try {
        if (mascotasDeclaradas >= 2 && mascotasGuardadas.length >= 2) {
          const m1 = mascotasGuardadas[0];
          const m2 = mascotasGuardadas[1];

          const [r1, r2] = await Promise.all([
            api.calculateQuote({
              species: m1.especie ?? 'CANINE',
              breedCode: m1.razaCodigo ?? 'CRIOLLO_MESTIZO',
              sizeCategory: m1.tamano,
              ageInMonths: m1.meses ?? 12,
              city: m1.ciudad ?? 'BOGOTA',
              gender: m1.sexo ?? 'MALE',
              petsInPolicy: 2,
              isSterilized: false,
              deductiblePercentage: deductible,
              selectedAddonKeys: addons,
              billingFrequency: 'MONTHLY',
            }),
            api.calculateQuote({
              species: m2.especie ?? 'CANINE',
              breedCode: m2.razaCodigo ?? 'CRIOLLO_MESTIZO',
              sizeCategory: m2.tamano,
              ageInMonths: m2.meses ?? 12,
              city: m2.ciudad ?? 'BOGOTA',
              gender: m2.sexo ?? 'MALE',
              petsInPolicy: 2,
              isSterilized: false,
              deductiblePercentage: deductible,
              selectedAddonKeys: addons,
              billingFrequency: 'MONTHLY',
            }),
          ]);

          if (!vivo) return;
          await new Promise((r) => setTimeout(r, 900));
          if (!vivo) return;

          setPlanMascota1(r1);
          setPlanMascota2(r2);
          setPlan(r1);
          setMascotaActivaTab(0);
          setError(null);
          decir(
            `Listo. Aquí tienes las pólizas de ${m1.nombre} y ${m2.nombre} con el 5% de descuento por múltiples mascotas aplicado en cada cuota.`,
          );
          setPaso('PLAN');
        } else {
          const m = mascotasGuardadas[0] || {
            nombre,
            especie,
            ciudad,
            sexo,
            meses,
            razaCodigo,
            tamano,
          };
          if (!m.especie || !m.ciudad || !m.sexo || m.meses === null || !m.razaCodigo) return;
          const input: PricingCalculationInput = {
            species: m.especie,
            breedCode: m.razaCodigo,
            sizeCategory: m.tamano,
            ageInMonths: m.meses,
            city: m.ciudad,
            gender: m.sexo,
            petsInPolicy: 1,
            isSterilized: false,
            deductiblePercentage: deductible,
            selectedAddonKeys: addons,
            billingFrequency: 'MONTHLY',
          };
          const res = await api.calculateQuote(input);
          if (!vivo) return;
          await new Promise((r) => setTimeout(r, 900));
          if (!vivo) return;
          setPlan(res);
          setPlanMascota1(res);
          setError(null);
          decir(`Listo. Esta es la póliza base de ${m.nombre}.`);
          setPaso('PLAN');
        }
      } catch (err: unknown) {
        if (!vivo) return;
        setPlan(null);
        setError(
          err instanceof MantoApiError && err.isUnreachable
            ? 'No pudimos calcular la cuota porque no hay conexión con Manto.'
            : err instanceof MantoApiError
              ? err.message
              : 'No pudimos calcular la cuota en este momento.',
        );
        setPaso('PLAN');
      } finally {
        clearInterval(reloj);
      }
    };

    calcular();

    return () => {
      vivo = false;
      clearInterval(reloj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, reintentoCalculo]);

  /**
   * Identificador secuencial para evitar condiciones de carrera en recálculos de cotización.
   * Solo la última petición en vuelo actualiza el estado del plan.
   */
  const latestRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Recálculo al mover los opcionales o el aporte de copago (10%, 15%, 20%).
   *
   * El total no se suma en el navegador: se le vuelve a pedir al motor. Así la
   * cifra que ve el cliente y la que emite la póliza son la misma, y la RC de
   * Ley 1801 aparece en el desglose porque viene en `activeAddons`.
   *
   * Protegido contra condiciones de carrera: solo la última petición despachada
   * actualiza el plan, sin congelar la UI ni bloquear los botones de copago.
   */
  useEffect(() => {
    if (paso !== 'PLAN' && paso !== 'OPCIONALES') return;

    // Cancelar cualquier petición previa en vuelo
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const currentRequestId = ++latestRequestIdRef.current;
    setRecalculando(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (mascotasDeclaradas >= 2 && mascotasGuardadas.length >= 2) {
      const m1 = mascotasGuardadas[0];
      const m2 = mascotasGuardadas[1];
      const petsInPolicyCount = mascotasFacturacion.length >= 2 ? 2 : 1;

      const input1: PricingCalculationInput = {
        species: m1.especie ?? 'CANINE',
        breedCode: m1.razaCodigo ?? 'CRIOLLO_MESTIZO',
        sizeCategory: m1.tamano,
        ageInMonths: m1.meses ?? 12,
        city: m1.ciudad ?? 'BOGOTA',
        gender: m1.sexo ?? 'MALE',
        petsInPolicy: petsInPolicyCount,
        isSterilized: false,
        deductiblePercentage: deductible,
        selectedAddonKeys: addons,
        billingFrequency: 'MONTHLY',
      };

      const input2: PricingCalculationInput = {
        species: m2.especie ?? 'CANINE',
        breedCode: m2.razaCodigo ?? 'CRIOLLO_MESTIZO',
        sizeCategory: m2.tamano,
        ageInMonths: m2.meses ?? 12,
        city: m2.ciudad ?? 'BOGOTA',
        gender: m2.sexo ?? 'MALE',
        petsInPolicy: petsInPolicyCount,
        isSterilized: false,
        deductiblePercentage: deductible,
        selectedAddonKeys: addons,
        billingFrequency: 'MONTHLY',
      };

      const espera = setTimeout(async () => {
        try {
          const [r1, r2] = await Promise.all([
            api.calculateQuote(input1, { signal: controller.signal }),
            api.calculateQuote(input2, { signal: controller.signal }),
          ]);

          if (latestRequestIdRef.current === currentRequestId) {
            setPlanMascota1(r1);
            setPlanMascota2(r2);
            setPlan(mascotaActivaTab === 0 ? r1 : r2);
            setErrorRecalculo(null);
            setRecalculando(false);
          }
        } catch (err: unknown) {
          const isAbort =
            (err instanceof Error && err.name === 'AbortError') ||
            (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AbortError') ||
            String(err).includes('AbortError') ||
            String(err).includes('aborted');

          if (isAbort) return;

          if (latestRequestIdRef.current === currentRequestId) {
            setRecalculando(false);
          }
        }
      }, 100);

      return () => {
        clearTimeout(espera);
        controller.abort();
      };
    } else {
      // 1 sola mascota
      const petActivo =
        mascotasGuardadas.length > 0 && mascotasGuardadas[0]
          ? mascotasGuardadas[0]
          : {
              especie,
              ciudad,
              sexo,
              meses,
              razaCodigo,
              tamano,
            };

      if (
        !petActivo.especie ||
        !petActivo.ciudad ||
        !petActivo.sexo ||
        petActivo.meses === null ||
        !petActivo.razaCodigo
      )
        return;

      const input: PricingCalculationInput = {
        species: petActivo.especie,
        breedCode: petActivo.razaCodigo,
        sizeCategory: petActivo.tamano,
        ageInMonths: petActivo.meses,
        city: petActivo.ciudad,
        gender: petActivo.sexo,
        petsInPolicy: 1,
        isSterilized: false,
        deductiblePercentage: deductible,
        selectedAddonKeys: addons,
        billingFrequency: 'MONTHLY',
      };

      const espera = setTimeout(async () => {
        try {
          const res = await api.calculateQuote(input, { signal: controller.signal });
          if (latestRequestIdRef.current === currentRequestId) {
            setPlan(res);
            setPlanMascota1(res);
            setErrorRecalculo(null);
            setRecalculando(false);
          }
        } catch (err: unknown) {
          const isAbort =
            (err instanceof Error && err.name === 'AbortError') ||
            (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AbortError') ||
            String(err).includes('AbortError') ||
            String(err).includes('aborted');

          if (isAbort) return;

          if (latestRequestIdRef.current === currentRequestId) {
            setRecalculando(false);
          }
        }
      }, 100);

      return () => {
        clearTimeout(espera);
        controller.abort();
      };
    }
  }, [paso, addons, deductible, mascotasFacturacion, mascotasGuardadas, mascotasDeclaradas, mascotaActivaTab]);

  // ---- Entradas por paso ----


  /** Bloque de reintento para cuando un catálogo del motor no cargó. */
  const bloqueCatalogoCaido = (
    <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-sm leading-relaxed text-amber-900">
          {errorCatalogo} No mostramos una lista incompleta: los datos tienen que venir del
          catálogo oficial.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={cargandoCatalogo}
        onClick={() => setReintentoCatalogo((n) => n + 1)}
      >
        {cargandoCatalogo ? 'Cargando…' : 'Reintentar'}
      </Button>
    </div>
  );

  const renderEntrada = () => {
    switch (paso) {
      case 'INICIO':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setCamaraAbierta(true)}
              className="group flex items-center gap-3.5 rounded-2xl border border-line bg-canvas-pure p-4 text-left shadow-xs transition-all hover:border-orange-brand hover:shadow-sm active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-subtle text-orange-brand shadow-xs group-hover:scale-105 transition-transform">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-navy-900">Mandarle una foto</span>
                <span className="block text-xs text-navy-500">Reconozco raza y contextura</span>
              </div>
            </button>
            <button
              type="button"
              onClick={responderConversemos}
              className="group flex items-center gap-3.5 rounded-2xl border border-line bg-canvas-pure p-4 text-left shadow-xs transition-all hover:border-orange-brand hover:shadow-sm active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-navy-600 shadow-xs group-hover:scale-105 transition-transform">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-navy-900">Conversemos</span>
                <span className="block text-xs text-navy-500">Te hago unas preguntas</span>
              </div>
            </button>
          </div>
        );

      case 'REINTENTO_FOTO':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setCamaraAbierta(true)}
              className="group flex items-center gap-3.5 rounded-2xl border-2 border-orange-brand/30 bg-orange-subtle/40 p-4 text-left shadow-xs transition-all hover:border-orange-brand hover:bg-orange-subtle/70 active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs text-orange-brand group-hover:scale-105 transition-transform">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-navy-900">
                  Tomar otra foto (intento {intentosFoto + 1} de {MAX_INTENTOS_FOTO})
                </span>
                <span className="block text-xs text-navy-500">
                  Enfoca de frente con buena luz
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={responderSeguirPorChat}
              className="group flex items-center gap-3.5 rounded-2xl border border-line bg-canvas-pure p-4 text-left shadow-xs transition-all hover:border-orange-brand hover:shadow-sm active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 shadow-xs text-navy-600 group-hover:scale-105 transition-transform">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-navy-900">
                  Seguir por chat
                </span>
                <span className="block text-xs text-navy-500">
                  Te hago unas preguntas rápidas
                </span>
              </div>
            </button>
          </div>
        );

      case 'CONFIRMAR_RAZA_FOTO':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={confirmarRazaFoto}
              className="group flex items-center gap-3.5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/50 p-4 text-left shadow-xs transition-all hover:border-emerald-600 hover:bg-emerald-50 active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-navy-900">
                  Sí, es {razaDetectadaCandidata?.name || 'esta raza'}
                </span>
                <span className="block text-xs text-emerald-800">
                  Confirmar raza identificada
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={rechazarRazaFoto}
              className="group flex items-center gap-3.5 rounded-2xl border border-line bg-canvas-pure p-4 text-left shadow-xs transition-all hover:border-orange-brand hover:shadow-sm active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-navy-600 shadow-xs group-hover:scale-105 transition-transform">
                <X className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-navy-900">
                  No, es otra raza
                </span>
                <span className="block text-xs text-navy-500">
                  Elegiré la raza más adelante
                </span>
              </div>
            </button>
          </div>
        );

      case 'MASCOTAS':
        return (
          <div className="max-w-md mx-auto w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={() => responderMascotas(1)}
              className="flex items-center justify-between p-4 rounded-2xl border border-line bg-canvas-pure text-left shadow-card hover:shadow-card-hover transition-all hover:border-orange-cta hover:-translate-y-0.5 active:scale-[0.98] group"
            >
              <div>
                <span className="block text-sm sm:text-base font-bold text-navy-900 group-hover:text-orange-cta transition-colors">
                  1 peludito
                </span>
                <span className="block text-xs text-navy-500 mt-1">
                  Protección individual completa
                </span>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-canvas-soft border border-line text-xs font-bold text-navy-700 shadow-xs">
                1
              </span>
            </button>

            <button
              type="button"
              onClick={() => responderMascotas(2)}
              className="flex items-center justify-between p-4 rounded-2xl border border-line bg-canvas-pure text-left shadow-card hover:shadow-card-hover transition-all hover:border-orange-cta hover:-translate-y-0.5 active:scale-[0.98] group"
            >
              <div>
                <span className="block text-sm sm:text-base font-bold text-navy-900 group-hover:text-orange-cta transition-colors">
                  2 o más peluditos
                </span>
                <span className="block text-xs font-semibold text-emerald-700 mt-1">
                  5% de descuento en cada póliza
                </span>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-subtle border border-orange-border/80 text-xs font-bold text-orange-brand shadow-xs">
                2+
              </span>
            </button>
          </div>
        );

      case 'NOMBRE':
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              responderNombre(texto);
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={
                mascotasDeclaradas > 1
                  ? mascotaActualIndex === 0
                    ? 'Nombre del primer peludito…'
                    : 'Nombre del segundo peludito…'
                  : 'Su nombre…'
              }
              className="flex-1 rounded-xl border border-line bg-canvas-pure px-4 py-3 outline-none transition-colors focus:border-orange-cta"
            />
            <Button type="submit" variant="primary" disabled={!texto.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        );

      case 'ESPECIE':
        return (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => responderEspecie('CANINE')}>
              Perro
            </Button>
            <Button variant="outline" onClick={() => responderEspecie('FELINE')}>
              Gato
            </Button>
          </div>
        );

      case 'CIUDAD':
        return (
          <div className="flex flex-wrap gap-2">
            {CIUDADES.map((c) => (
              <Button key={c.id} variant="outline" size="sm" onClick={() => responderCiudad(c.id)}>
                {c.label}
              </Button>
            ))}
          </div>
        );

      case 'SEXO':
        return (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => responderSexo('MALE')}>
              Niño
            </Button>
            <Button variant="outline" onClick={() => responderSexo('FEMALE')}>
              Niña
            </Button>
          </div>
        );

      case 'EDAD': {
        const opcionesEdad: DropdownOption<number>[] = AGE_DROPDOWN_OPTIONS.filter((o) => o.isEligible).map((o) => ({
          id: o.id,
          label: o.label.split('(')[0].trim(),
          sublabel: `${o.ageInMonths} meses`,
          badge: o.ageInMonths <= 11 ? 'Cachorro' : o.ageInMonths >= 96 ? 'Senior' : 'Adulto',
          data: o.ageInMonths,
        }));

        return (
          <FilterableDropdown<number>
            options={opcionesEdad}
            placeholder="Selecciona o escribe..."
            headerTitle="Edades asegurables (de 2 meses a 14+ años)"
            onSelect={(opt) => {
              const mesesVal = opt.data ?? 12;
              responderEdad(mesesVal, opt.label);
            }}
            onDirectConfirm={(query) => {
              const interpretado = interpretarEdad(query);
              if (interpretado !== null) {
                responderEdad(interpretado, formatMonthsToAgeString(interpretado));
              }
            }}
          />
        );
      }

      case 'RAZA': {
        if (errorCatalogo) return bloqueCatalogoCaido;
        if (cargandoCatalogo) {
          return (
            <div className="flex items-center gap-3 text-navy-500 p-4 rounded-xl border border-line bg-canvas-pure">
              <RefreshCw className="h-4 w-4 animate-spin text-orange-cta" />
              <span className="text-sm">Cargando el catálogo oficial de razas…</span>
            </div>
          );
        }

        // CRUCIAL: El dropdown muestra únicamente el nombre limpio de la raza sin etiquetas
        // visibles como "Ley 1801 (Manejo Especial)" ni "Peligroso".
        const opcionesRazas: DropdownOption<BreedCatalogEntry>[] = razas
          .filter((b) => !especie || b.species === especie)
          .map((b) => ({
            id: b.code,
            label: b.name, // Nombre limpio exclusivamente
            sublabel: b.typicalSize ? `Tamaño ${b.typicalSize.toLowerCase()}` : undefined,
            data: b,
          }));

        return (
          <FilterableDropdown<BreedCatalogEntry>
            options={opcionesRazas}
            placeholder="Selecciona o escribe..."
            headerTitle={`Catálogo oficial Manto · ${especie === 'CANINE' ? 'Caninos' : 'Felinos'}`}
            onSelect={(opt) => {
              responderRaza(opt.id, opt.label);
            }}
            emptyMessage={
              <div className="p-4 text-center space-y-3">
                <p className="text-sm text-navy-600">
                  No encontramos una coincidencia exacta en el catálogo oficial de {especie === 'CANINE' ? 'perros' : 'gatos'}.
                </p>
                <button
                  type="button"
                  onClick={() => responderRaza('CRIOLLO_MESTIZO', 'Criollo / Mestizo')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-subtle px-4 py-2 text-xs font-bold text-orange-brand border border-orange-border hover:bg-orange-brand hover:text-white transition-colors"
                >
                  <span>Seleccionar como Criollo / Mestizo</span>
                  <span>→</span>
                </button>
              </div>
            }
          />
        );
      }

      default:
        return null;
    }
  };

  // ---- Plan base ----

  // ---- Configurador Unificado de Póliza ----

  const cambiarDeducible = (nuevo: DeductibleOption) => {
    setErrorRecalculo(null);
    setDeductible(nuevo);
  };

  const alternarAddon = (clave: AddonKey) => {
    setErrorRecalculo(null);
    setAddons((prev) =>
      prev.includes(clave) ? prev.filter((k) => k !== clave) : [...prev, clave],
    );
  };

  /**
   * Los opcionales que el cliente puede elegir, tal como los sirve el motor.
   * La RC de Ley 1801 no aparece: es obligatoria y la anexa el backend.
   */
  const opcionalesElegibles = useMemo(
    () => opcionales.filter((a) => !a.isMandatoryByLaw),
    [opcionales],
  );

  /** Emite la cotización formal en el servidor y abre el checkout. */
  const irAlCheckout = async () => {
    if (emitiendoRef.current || recalculando) return;

    emitiendoRef.current = true;
    setEmitiendo(true);
    try {
      if (mascotasDeclaradas >= 2 && mascotasGuardadas.length >= 2) {
        // Multi-mascota: filtramos las mascotas marcadas en mascotasFacturacion
        const seleccionadas = mascotasFacturacion.map((i) => mascotasGuardadas[i]);
        if (seleccionadas.length === 0) return;

        const petsInPolicyCount = seleccionadas.length >= 2 ? 2 : 1;

        const quotesCreadas = await Promise.all(
          seleccionadas.map((pet) =>
            api.createQuote({
              petName: pet.nombre,
              species: pet.especie ?? 'CANINE',
              breedCode: pet.razaCodigo ?? 'CRIOLLO_MESTIZO',
              sizeCategory: pet.tamano,
              ageInMonths: pet.meses ?? 12,
              city: pet.ciudad ?? 'BOGOTA',
              gender: pet.sexo ?? 'MALE',
              petsInPolicy: petsInPolicyCount,
              isSterilized: false,
              deductiblePercentage: deductible,
              selectedAddonKeys: addons,
              billingFrequency: 'MONTHLY',
            }),
          ),
        );

        const rechazada = quotesCreadas.find((q) => q.status === 'REJECTED' || !q.pricingResult);
        if (rechazada) {
          const motivos = rechazada.rejectionReasons ?? rechazada.eligibilityResult?.rejectionReasons ?? [];
          setErrorRecalculo(
            motivos.length > 0
              ? motivos.join(' ')
              : 'No pudimos asegurar una de las mascotas con estos datos. Escríbenos y lo revisamos contigo.',
          );
          return;
        }

        const breakdown = quotesCreadas.map((q) => ({
          name: q.petData.name,
          amountCop: q.pricingResult?.totalMonthlyPremiumCop ?? 0,
        }));
        const totalFacturar = breakdown.reduce((sum, item) => sum + item.amountCop, 0);

        setCotizacion(quotesCreadas[0]);
        setCheckoutBreakdown(breakdown);
        setCheckoutPetName(breakdown.map((b) => b.name).join(' y '));
        setCheckoutTotalAmount(totalFacturar);
        setCheckoutAbierto(true);
      } else {
        // Mascota individual
        const petActivo =
          mascotasGuardadas.length > 0 && mascotasGuardadas[0]
            ? mascotasGuardadas[0]
            : {
                nombre,
                especie,
                ciudad,
                sexo,
                meses,
                razaCodigo,
                tamano,
              };

        const q = await api.createQuote({
          petName: petActivo.nombre,
          species: petActivo.especie ?? 'CANINE',
          breedCode: petActivo.razaCodigo ?? 'CRIOLLO_MESTIZO',
          sizeCategory: petActivo.tamano,
          ageInMonths: petActivo.meses ?? 12,
          city: petActivo.ciudad ?? 'BOGOTA',
          gender: petActivo.sexo ?? 'MALE',
          petsInPolicy: 1,
          isSterilized: false,
          deductiblePercentage: deductible,
          selectedAddonKeys: addons,
          billingFrequency: 'MONTHLY',
        });

        if (q.status === 'REJECTED' || !q.pricingResult) {
          const motivos = q.rejectionReasons ?? q.eligibilityResult?.rejectionReasons ?? [];
          setErrorRecalculo(
            motivos.length > 0
              ? motivos.join(' ')
              : `No podemos asegurar a ${petActivo.nombre} con estos datos. Escríbenos y lo revisamos contigo.`,
          );
          return;
        }

        setCotizacion(q);
        setPlan(q.pricingResult);
        setCheckoutBreakdown([{ name: petActivo.nombre, amountCop: q.pricingResult.totalMonthlyPremiumCop }]);
        setCheckoutPetName(petActivo.nombre);
        setCheckoutTotalAmount(q.pricingResult.totalMonthlyPremiumCop);
        setCheckoutAbierto(true);
      }
    } catch (err) {
      setErrorRecalculo(
        err instanceof MantoApiError
          ? err.message
          : 'No pudimos emitir la cotización. Intenta de nuevo.',
      );
    } finally {
      emitiendoRef.current = false;
      setEmitiendo(false);
    }
  };

  const renderPlan = () => {
    if (error && !plan) {
      return (
        <div className="space-y-4 rounded-2xl border border-line bg-canvas-pure p-6 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-600" />
          <div className="space-y-1.5">
            <h3 className="font-semibold text-navy-900">No pudimos calcular la cuota</h3>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-navy-500">
              {error} No mostramos un precio estimado: la cuota tiene que venir del cálculo oficial.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              setError(null);
              setReintentoCalculo((n) => n + 1);
              setPaso('CALCULANDO');
            }}
          >
            Reintentar
          </Button>
        </div>
      );
    }
    if (!plan) return null;

    const petActivo =
      mascotasGuardadas.length > 0 && mascotasGuardadas[mascotaActivaTab]
        ? mascotasGuardadas[mascotaActivaTab]
        : {
            nombre,
            razaNombre,
            meses,
            sexo,
            ciudad,
          };

    return (
      <div className="space-y-6 rounded-2xl border border-line bg-canvas-pure p-5 sm:p-7 shadow-xs pb-24 sm:pb-7">
        {/* Banner Multi-Mascota */}
        {mascotasDeclaradas >= 2 && mascotasGuardadas.length >= 2 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-xs">
                {mascotasFacturacion.length >= 2 ? '5%' : '✓'}
              </span>
              <div>
                <h4 className="text-sm font-bold text-emerald-950">
                  {mascotasFacturacion.length >= 2
                    ? 'Descuento Multi-Mascota Aplicado'
                    : 'Cotización para 1 Mascota Seleccionada'}
                </h4>
                <p className="text-xs text-emerald-800">
                  {mascotasFacturacion.length >= 2
                    ? '5% de descuento en la tarifa mensual de ambas pólizas'
                    : 'Marca ambas mascotas en el check para activar el 5% de descuento grupal'}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                {mascotasFacturacion.length >= 2 ? 'Total 2 Mascotas' : 'Total 1 Mascota'}
              </span>
              <p className="text-base sm:text-lg font-black text-emerald-950">
                {formatCop(primaTotalFacturacion)}/mes
              </p>
            </div>
          </div>
        )}

        {/* Selector de Pestañas Multi-Mascota */}
        {mascotasDeclaradas >= 2 && mascotasGuardadas.length >= 2 && (
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <button
              type="button"
              onClick={() => {
                setMascotaActivaTab(0);
                if (planMascota1) setPlan(planMascota1);
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all',
                mascotaActivaTab === 0
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-canvas-soft text-navy-600 hover:bg-slate-100',
              )}
            >
              <PawPrint className="h-4 w-4" />
              <span>{mascotasGuardadas[0]?.nombre}</span>
              <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px]">
                {formatCop(planMascota1?.totalMonthlyPremiumCop ?? 0)}
              </span>
              {mascotasFacturacion.includes(0) && (
                <span className="rounded-full bg-emerald-500/20 text-emerald-700 px-1.5 py-0.5 text-[9px] font-bold">
                  ✓ Facturar
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMascotaActivaTab(1);
                if (planMascota2) setPlan(planMascota2);
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all',
                mascotaActivaTab === 1
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-canvas-soft text-navy-600 hover:bg-slate-100',
              )}
            >
              <PawPrint className="h-4 w-4" />
              <span>{mascotasGuardadas[1]?.nombre}</span>
              <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px]">
                {formatCop(planMascota2?.totalMonthlyPremiumCop ?? 0)}
              </span>
              {mascotasFacturacion.includes(1) && (
                <span className="rounded-full bg-emerald-500/20 text-emerald-700 px-1.5 py-0.5 text-[9px] font-bold">
                  ✓ Facturar
                </span>
              )}
            </button>
          </div>
        )}

        {/* Cabecera y Resumen de Mascota */}
        <div className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-brand border border-orange-200">
                <Sparkles className="h-3 w-3" /> Póliza Personalizada
              </span>
              <span className="text-xs text-navy-500">
                {petActivo.ciudad && CIUDADES.find((c) => c.id === petActivo.ciudad)?.label}
              </span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-navy-900 sm:text-2xl">
              Plan Manto para {petActivo.nombre}
            </h2>
            <p className="text-xs text-navy-500 sm:text-sm">
              {petActivo.razaNombre} · {petActivo.meses !== null && formatMonthsToAgeString(petActivo.meses)} · {petActivo.sexo === 'MALE' ? 'Macho' : 'Hembra'}
            </p>
          </div>

          <div className="mt-2 text-left sm:mt-0 sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-navy-500">Cuota mensual estimada</p>
            <div className="flex items-baseline gap-1.5">
              {recalculando && <RefreshCw className="h-3.5 w-3.5 animate-spin text-orange-cta" />}
              <span className="text-3xl font-extrabold tracking-tight tabular-nums text-navy-900 sm:text-4xl">
                <AnimatedNumber value={plan.totalMonthlyPremiumCop} />
              </span>
              <span className="text-sm font-medium text-navy-500">/mes</span>
            </div>
          </div>
        </div>

        {/* 1. Selector de Deducible / Aporte por Evento */}
        <DeductibleSelector
          selected={deductible}
          onChange={cambiarDeducible}
          disabled={false}
        />

        {/* 2. Coberturas Base Incluidas */}
        <div className="rounded-xl border border-line bg-canvas/60 p-4 space-y-3">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setMostrarDetalleBase((prev) => !prev)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setMostrarDetalleBase((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-navy-900">
                  Coberturas Base Incluidas ({plan.guaranteedBaselineCoverages.length} amparos vitales)
                </p>
                <p className="text-xs text-navy-500">
                  Accidentes, urgencias hospitalarias y diagnósticos con {(deductible * 100).toFixed(0)}% de aporte
                </p>
              </div>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-semibold text-orange-brand hover:text-orange-hover shrink-0"
            >
              {mostrarDetalleBase ? 'Ocultar' : 'Ver detalle'}
              {mostrarDetalleBase ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {mostrarDetalleBase && (
            <div className="space-y-0 border-t border-line-soft pt-2">
              {plan.guaranteedBaselineCoverages.map((c) => (
                <div key={c.code} className="flex justify-between gap-4 border-b border-line-soft py-2.5 last:border-0 text-xs">
                  <div className="max-w-md">
                    <p className="font-semibold text-navy-900">{c.name}</p>
                    <p className="mt-0.5 text-navy-500 leading-relaxed">{c.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-navy-900 tabular-nums">{formatCop(c.annualLimitCop)}</p>
                    <p className="text-emerald-700 font-medium">Copago {(c.copayDeductiblePercentage * 100).toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Ley 1801 de 2016 (Manejo Especial Canino) */}
        {plan.mandatoryCivilLiabilityAttached &&
          (() => {
            const rce = plan.activeAddons.find((a) => a.key === 'CIVIL_LIABILITY_1801');
            return (
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 space-y-1.5">
                <div className="flex justify-between items-center text-amber-950 font-bold text-sm">
                  <span>Responsabilidad Civil Extracontractual (Ley 1801)</span>
                  <span className="tabular-nums">{formatCop(rce?.annualLimitCop ?? 0)}</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-900">
                  Obligatoria por ley para esta raza (50 SMLMV de valor asegurado). Emite carnet y certificado legal para la Alcaldía y la Policía Nacional. Su cuota de {formatCop(rce?.monthlyPremiumCop ?? 0)}/mes ya está integrada en el total.
                </p>
              </div>
            );
          })()}

        {/* 4. Opcionales / Add-ons */}
        <div className="space-y-3 pt-2">
          <div>
            <h3 className="text-base font-bold text-navy-900">
              Personaliza con coberturas adicionales
            </h3>
            <p className="text-xs text-navy-500">
              Actívalas o desactívalas según las necesidades de {nombre}. Se recalculan al instante en el servidor.
            </p>
          </div>

          <div className="space-y-2">
            {opcionalesElegibles.map((a) => {
              const activo = addons.includes(a.key);
              const esBienestar = a.key === 'PREVENTIVE_WELLNESS';
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => alternarAddon(a.key)}
                  aria-pressed={activo}
                  className={`flex w-full items-start gap-3.5 rounded-xl border p-3.5 text-left transition-all ${
                    activo
                      ? 'border-orange-cta bg-orange-50/30 ring-1 ring-orange-cta/30 shadow-xs'
                      : 'border-line bg-canvas-pure hover:border-navy-300 hover:bg-canvas'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      activo ? 'border-orange-cta bg-orange-cta' : 'border-line bg-canvas-pure'
                    }`}
                  >
                    {activo && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#fff" strokeWidth="3.5">
                        <path d="m5 13 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-navy-900">{a.name}</span>
                      {esBienestar && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                          0% Aporte · Día 1
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-navy-500 leading-relaxed mt-0.5">{a.description}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-navy-500 font-medium">
                      <span>
                        {a.hasNoAnnualLimit ? 'Sin límite anual' : `Tope: ${formatCop(a.annualLimitCop)}/año`}
                      </span>
                      <span>·</span>
                      <span>
                        {a.waitingPeriodDays === 0 ? 'Sin carencia (activo de inmediato)' : `Activación: ${a.waitingPeriodDays} días`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="block font-bold text-sm text-navy-900 tabular-nums">
                      +{formatCop(a.monthlyPremiumCop)}
                    </span>
                    <span className="text-[11px] text-navy-500">/mes</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selección de Mascotas para Facturación (Multi-Mascota) */}
        {mascotasDeclaradas >= 2 && mascotasGuardadas.length >= 2 && (
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-orange-brand" />
                  Mascotas a incluir en la facturación
                </h3>
                <span className="text-xs font-semibold text-navy-600 bg-canvas-soft border border-line px-2.5 py-0.5 rounded-full">
                  {mascotasFacturacion.length} de {mascotasGuardadas.length} seleccionadas
                </span>
              </div>
              <p className="text-xs text-navy-500 mt-0.5">
                Elige con el check si deseas emitir y pagar una o ambas pólizas juntas en este pedido.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {mascotasGuardadas.map((pet, idx) => {
                const seleccionada = mascotasFacturacion.includes(idx);
                const petPlan = idx === 0 ? planMascota1 : planMascota2;
                const petTotal = petPlan?.totalMonthlyPremiumCop ?? 0;

                return (
                  <button
                    key={pet.nombre + idx}
                    type="button"
                    onClick={() => toggleMascotaFacturacion(idx)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-4 text-left transition-all relative overflow-hidden',
                      seleccionada
                        ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/30 shadow-xs'
                        : 'border-line bg-canvas-pure opacity-75 hover:opacity-100 hover:border-slate-300'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                        seleccionada
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      )}
                    >
                      {seleccionada && (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5">
                          <path d="m5 13 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-navy-900">{pet.nombre}</span>
                        {seleccionada ? (
                          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                            {mascotasFacturacion.length >= 2 ? '5% Dto. Grupo' : 'Seleccionada'}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-medium">
                            No facturar
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-navy-500 mt-0.5 truncate">
                        {pet.razaNombre} · {pet.meses !== null && formatMonthsToAgeString(pet.meses)}
                      </p>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className={cn('text-base font-extrabold tabular-nums', seleccionada ? 'text-navy-900' : 'text-slate-400')}>
                          {formatCop(petTotal)}
                        </span>
                        <span className="text-[11px] text-navy-500">/mes</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {mascotasFacturacion.length === 1 && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>Tip: Si seleccionas ambas mascotas, se aplica automáticamente el <strong>5% de descuento</strong> en ambas pólizas.</span>
              </p>
            )}
          </div>
        )}

        {/* 5. Desglose Transparente */}
        <div className="space-y-2 border-t border-line pt-4">
          <div className="flex justify-between text-xs text-navy-500">
            <span>Póliza base de {petActivo.nombre} ({((deductible) * 100).toFixed(0)}% aporte por evento)</span>
            <span className="tabular-nums">{formatCop(plan.baseMonthlyPremiumCop)}</span>
          </div>
          {plan.activeAddons.map((a) => (
            <div key={a.key} className="flex justify-between text-xs text-navy-500">
              <span>
                {a.name}
                {a.isMandatoryByLaw && ' · obligatoria'}
              </span>
              <span className="tabular-nums">+{formatCop(a.monthlyPremiumCop)}</span>
            </div>
          ))}

          {/* Si es multi-mascota, mostrar el consolidado de pólizas a facturar */}
          {mascotasDeclaradas >= 2 && mascotasGuardadas.length >= 2 && (
            <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Pólizas incluidas en la facturación ({mascotasFacturacion.length} de {mascotasGuardadas.length}):
              </span>
              {mascotasGuardadas.map((pet, idx) => {
                const checked = mascotasFacturacion.includes(idx);
                const planItem = idx === 0 ? planMascota1 : planMascota2;
                return (
                  <div key={pet.nombre + idx} className="flex justify-between items-center text-xs">
                    <span className={checked ? 'text-navy-900 font-medium' : 'text-slate-400 line-through'}>
                      {checked ? '✓ ' : '✕ '} Póliza de {pet.nombre}
                    </span>
                    <span className={cn('tabular-nums font-semibold', checked ? 'text-navy-900' : 'text-slate-400')}>
                      {checked ? `${formatCop(planItem?.totalMonthlyPremiumCop ?? 0)}/mes` : 'No incluida'}
                    </span>
                  </div>
                );
              })}
              {mascotasFacturacion.length >= 2 && (
                <div className="flex justify-between items-center text-[11px] text-emerald-700 font-medium pt-1 border-t border-slate-200">
                  <span>Descuento 5% multi-mascota</span>
                  <span>Aplicado a cada póliza</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <div>
              <span className="text-base font-bold text-navy-900">
                {mascotasDeclaradas >= 2 && mascotasGuardadas.length >= 2
                  ? `Total facturación (${mascotasFacturacion.length} ${mascotasFacturacion.length === 1 ? 'mascota' : 'mascotas'})`
                  : 'Total mensual definitivo'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {recalculando && <RefreshCw className="h-3.5 w-3.5 animate-spin text-orange-cta" />}
              <span className="text-2xl font-extrabold text-navy-900 tabular-nums">
                <AnimatedNumber value={primaTotalFacturacion} />
              </span>
              <span className="text-xs text-navy-500">/mes</span>
            </div>
          </div>
        </div>

        {errorRecalculo && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm leading-relaxed text-amber-900">{errorRecalculo}</p>
          </div>
        )}

        {/* Botón Desktop */}
        <div className="hidden sm:block pt-2">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            disabled={recalculando || emitiendo || errorRecalculo !== null || mascotasFacturacion.length === 0}
            onClick={irAlCheckout}
          >
            {emitiendo
              ? 'Emitiendo cotización formal…'
              : recalculando
                ? 'Actualizando cuota…'
                : mascotasDeclaradas >= 2 && mascotasGuardadas.length >= 2
                  ? `Facturar ${mascotasFacturacion.length} ${mascotasFacturacion.length === 1 ? 'mascota' : 'mascotas'} (${formatCop(primaTotalFacturacion)}/mes)`
                  : 'Continuar con la emisión'}
          </Button>
          <p className="mt-2 text-center text-xs text-navy-500">
            Cotización oficial congelada por 15 días. Pago seguro con Wompi (Bancolombia, PSE, Nequi, Tarjetas).
          </p>
        </div>

        {/* Barra Fija Inferior Mobile (Sticky Bottom Bar) */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-canvas-pure/95 p-3.5 shadow-xl backdrop-blur-md sm:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-navy-500">
                {mascotasDeclaradas >= 2 ? `Total (${mascotasFacturacion.length} pets)` : 'Total al mes'}
              </p>
              <p className="text-lg font-extrabold tabular-nums text-navy-900">
                <AnimatedNumber value={primaTotalFacturacion} />
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              disabled={recalculando || emitiendo || errorRecalculo !== null || mascotasFacturacion.length === 0}
              onClick={irAlCheckout}
            >
              {emitiendo ? 'Emitiendo…' : 'Continuar'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderOpcionales = () => {
    return renderPlan();
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-8 pt-8 sm:px-6">
      {error && paso !== 'PLAN' && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed text-amber-900">{error}</p>
        </div>
      )}

      {/* Hilo */}
      <div className="flex-1 space-y-1">
        {turnos.map((t) => (
          <ChatBubble
            key={t.id}
            role={t.de === 'nuqui' ? 'assistant' : 'user'}
            content={t.texto}
            image={t.imagen}
          />
        ))}

        {escribiendo && <TypingIndicator />}

        {paso === 'CALCULANDO' && (
          <div className="flex items-center gap-3 py-4 text-navy-500">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-cta" />
            <span className="text-sm">{ETAPAS_CALCULO[etapaCalculo]}</span>
          </div>
        )}

        <div ref={finRef} />
      </div>

      {/* Entrada o resultado */}
      <div className="mt-6">
        {paso === 'PLAN'
          ? renderPlan()
          : paso === 'OPCIONALES'
            ? renderOpcionales()
            : !escribiendo && renderEntrada()}
      </div>

      <LiveCameraModal
        isOpen={camaraAbierta}
        onClose={() => setCamaraAbierta(false)}
        onCapture={(img) => tomarFoto(img)}
      />

      {cotizacion?.pricingResult && (
        <CheckoutDrawer
          isOpen={checkoutAbierto}
          onClose={() => setCheckoutAbierto(false)}
          quoteId={cotizacion.id}
          totalAmountCop={checkoutTotalAmount || primaTotalFacturacion || cotizacion.pricingResult.totalMonthlyPremiumCop}
          billingFrequency={cotizacion.billingFrequency}
          petName={checkoutPetName || (mascotasGuardadas[mascotaActivaTab]?.nombre || nombre)}
          petBreakdown={checkoutBreakdown}
        />
      )}
    </div>
  );
};

export default NuquiAssistant;
