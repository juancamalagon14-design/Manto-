import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  AGE_DROPDOWN_OPTIONS,
  ChatMode,
  ChatMessage,
  ChatSessionState,
  ChatSlots,
  ConversationStep,
  InteractiveOption,
} from './ai.types';
import { SendLivePhotoDto, StartChatDto } from './dto/chat.dto';
import { GeminiProvider } from './gemini.provider';

/**
 * Sesión conversacional y análisis de foto.
 *
 * Deliberadamente NO cotiza. Nuquí conduce la secuencia en el frontend y le
 * pide las cifras al motor actuarial (POST /v1/pricing/calculate-quote) y la
 * cotización formal a QuotesService (POST /v1/quotes). Este servicio no
 * depende de QuotesService: si volviera a depender, volvería a haber dos
 * cotizadores.
 */
@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly sessions = new Map<string, ChatSessionState>();

  /**
   * Cuánto vive una sesión antes de purgarse.
   *
   * La sesión guarda nombre, correo y teléfono del titular. Sin caducidad, ese
   * dato personal se quedaba en memoria indefinidamente, sin política de
   * retención ni vía de supresión: incumplimiento directo de la Ley 1581 de
   * 2012. Dos horas cubren de sobra una cotización, que toma minutos.
   *
   * La foto nunca se retiene: el historial guarda solo un marcador de texto.
   */
  private static readonly SESSION_TTL_MS = 2 * 60 * 60 * 1000;

  constructor(private readonly geminiProvider: GeminiProvider) {}

  /**
   * Obtiene la sesión, ya purgada si venció.
   *
   * Devuelve una copia: antes entregaba la referencia viva del Map, así que
   * cualquiera que leyera `GET /v1/ai/chat/:sessionId` podía mutar el estado
   * de la sesión del servidor. Es la misma regla de inmutabilidad que aplican
   * los repositorios con `structuredClone`.
   */
  public getSession(sessionId: string): ChatSessionState {
    return structuredClone(this.getSessionMutable(sessionId));
  }

  /** Referencia viva, para uso interno del servicio. */
  private getSessionMutable(sessionId: string): ChatSessionState {
    this.purgeExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      // No se refleja el identificador recibido: no le aporta nada al cliente
      // y sí sirve para sondear el servicio.
      throw new NotFoundException('Sesión conversacional no encontrada o vencida');
    }
    return session;
  }

  /**
   * Purga las sesiones vencidas. Se ejecuta en cada acceso en vez de con un
   * temporizador, para no dejar un intervalo colgando en las pruebas ni en un
   * proceso que se apaga.
   */
  private purgeExpiredSessions(): void {
    const limite = Date.now() - AiChatService.SESSION_TTL_MS;
    for (const [id, sesion] of this.sessions) {
      if (new Date(sesion.updatedAt).getTime() < limite) {
        this.sessions.delete(id);
        this.logger.log(`Sesión ${id} purgada por vencimiento de retención`);
      }
    }
  }

  /**
   * Retorna el catálogo completo de opciones de edad para el desplegable de UI.
   */
  public getAgeDropdownOptions() {
    return AGE_DROPDOWN_OPTIONS;
  }

  /**
   * 1. Inicia una nueva sesión conversacional estilo Insurtech Nativa.
   * Saludo cálido: "Soy Nuquí de Manto 🐾".
   * Bifurcación inicial: [ 📸 Tomar Foto en Vivo ] vs [ 💬 Chat Guiado ].
   */
  public startChat(dto?: StartChatDto): { session: ChatSessionState; welcomeMessage: ChatMessage } {
    const sessionId = uuidv4();
    const now = new Date().toISOString();
    const mode: ChatMode = dto?.mode || 'INITIAL_SELECTION';

    // Solo lo que esta sesión realmente conoce. Antes sembraba
    // `deductiblePercentage: 0.15`, `selectedAddonKeys: []` y
    // `billingFrequency: 'MONTHLY'`, y `GET /v1/ai/chat/:sessionId` los
    // devolvía como si el cliente los hubiera elegido. Ningún endpoint
    // podía cambiarlos: eran una tercera fuente de verdad sobre el deducible,
    // callada y siempre igual.
    const slots: ChatSlots = {
      customerName: dto?.customerName,
      customerEmail: dto?.customerEmail,
      customerPhone: dto?.customerPhone,
    };

    // Este saludo es el que la interfaz muestra. Vive aquí, en un solo lugar:
    // Nuquí lo lee de `welcomeMessage` en vez de escribir su propia copia.
    let initialStep: ConversationStep = 'SELECT_MODE';
    let welcomeText =
      '¡Hola! Soy Nuquí, de Manto. Te ayudo a cotizar el seguro de tu mascota en un par de minutos.';
    let initialOptions: InteractiveOption[] = [
      {
        id: 'MODE_LIVE_CAMERA',
        label: 'Mandarle una foto',
        value: 'LIVE_CAMERA',
        description: 'Reconozco raza y contextura',
      },
      {
        // El valor ya no es un ChatMode: conversar es una rama de la interfaz,
        // no un modo de sesión del servidor.
        id: 'MODE_GUIDED_CHAT',
        label: 'Conversemos',
        value: 'CHAT',
        description: 'Te hago unas preguntas',
      },
    ];

    if (mode === 'LIVE_CAMERA') {
      initialStep = 'CAMERA_CAPTURE';
      welcomeText =
        'Activa la cámara y tómale una foto de frente. Por seguridad solo aceptamos fotos tomadas en vivo, no archivos de la galería.';
      initialOptions = [];
    }

    const welcomeMessage: ChatMessage = {
      id: uuidv4(),
      sender: 'assistant',
      text: welcomeText,
      inputType: mode === 'LIVE_CAMERA' ? 'camera_capture' : 'mode_selection',
      options: initialOptions,
      timestamp: now,
    };

    const session: ChatSessionState = {
      sessionId,
      mode,
      currentStep: initialStep,
      slots,
      history: [welcomeMessage],
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    this.logger.log(`Nueva sesión de chat creada: ${sessionId} (Modo: ${mode})`);

    return { session, welcomeMessage };
  }

  /**
   * 2. Procesa capturas de cámara en vivo (Restricción Estricta de Cámara).
   * Valida estrictamente `isLiveCapture: true` y descarta adjuntos de disco.
   * Ejecuta Gemini 2.0 Flash Vision.
   * MUST: Inmediatamente tras procesar la foto, transiciona obligatoriamente
   * a POST_PHOTO_AGE_VERIFICATION presentando el selector desplegable de edad.
   */
  public async processLivePhoto(
    sessionId: string,
    dto: SendLivePhotoDto,
  ): Promise<{ session: ChatSessionState; reply: ChatMessage }> {
    const session = this.getSessionMutable(sessionId);

    // RESTRICCIÓN ESTRICTA DE CÁMARA (Doctrina Lemonade / Manto 2.0)
    if (!dto.isLiveCapture) {
      throw new BadRequestException(
        'Por restricciones estrictas de suscripción y verificación antifraude, únicamente se admiten capturas de cámara tomadas en vivo. No se permiten fotos adjuntas de disco ni de galería.',
      );
    }

    if (!dto.imageBase64 || dto.imageBase64.trim().length === 0) {
      throw new BadRequestException('El campo imageBase64 es obligatorio para el análisis de cámara en vivo.');
    }

    const now = new Date().toISOString();
    session.mode = 'LIVE_CAMERA';

    // Registrar mensaje del usuario con la foto en el historial
    session.history.push({
      id: uuidv4(),
      sender: 'user',
      text: '📸 [Captura en vivo de cámara enviada]',
      inputType: 'none',
      timestamp: now,
      metadata: { isLiveCapture: true, timestampCaptured: dto.timestampCaptured },
    });

    // Invocación a Gemini 2.0 Flash Vision
    const analysis = await this.geminiProvider.analyzeLivePhoto(dto.imageBase64, dto.mimeType);

    if (!analysis.petDetected || analysis.errorReason) {
      const errorReply: ChatMessage = {
        id: uuidv4(),
        sender: 'assistant',
        text:
          analysis.errorReason ||
          'No logré reconocer claramente a tu mascota en la toma en vivo. ¿Intentamos con otra toma o prefieres continuar por chat?',
        inputType: 'mode_selection',
        options: [
          { id: 'RETRY_LIVE_PHOTO', label: 'Reintentar la foto', value: 'RETRY' },
          { id: 'SWITCH_GUIDED_CHAT', label: 'Seguir conversando', value: 'CHAT' },
        ],
        timestamp: new Date().toISOString(),
      };
      session.history.push(errorReply);
      session.updatedAt = new Date().toISOString();
      return { session, reply: errorReply };
    }

    // Actualizar slots con datos detectados por IA
    session.slots.species = analysis.species;
    session.slots.breedCode = analysis.breedCode;
    session.slots.breedName = analysis.breedName;
    session.slots.sizeCategory = analysis.sizeCategory;
    session.slots.isLiveCaptureValidated = true;

    // MUST: VERIFICACIÓN DE EDAD OBLIGATORIA POST-FOTO
    session.currentStep = 'POST_PHOTO_AGE_VERIFICATION';

    const ageOptions: InteractiveOption[] = AGE_DROPDOWN_OPTIONS.map((opt) => ({
      id: opt.id,
      label: opt.label,
      value: opt.id,
      description: opt.warningMessage,
      isEligible: opt.isEligible,
    }));

    const reply: ChatMessage = {
      id: uuidv4(),
      sender: 'assistant',
      text:
        analysis.confidence >= 0.6
          ? `¡Qué belleza de peludo! 🥰 Detecto que es un **${analysis.breedName}**. Si me equivoqué lo corriges después. ¿Cuántos meses o años tiene?`
          : `No logré reconocer bien la raza en la foto, así que la confirmamos contigo más adelante. Por ahora, ¿cuántos meses o años tiene?`,
      inputType: 'age_dropdown',
      options: ageOptions,
      timestamp: new Date().toISOString(),
      metadata: {
        detectedBreed: analysis.breedName,
        breedCode: analysis.breedCode,
        species: analysis.species,
        confidence: analysis.confidence,
        /**
         * Por debajo de este umbral la raza NO puede darse por buena: hay que
         * confirmarla con la persona. Si no, una detección de respaldo podría
         * tarificar una raza de Ley 1801 como raza común y omitir la RC obligatoria.
         */
        requiresBreedConfirmation: analysis.confidence < 0.6,
        estimatedAgePreliminary: analysis.estimatedAgeMonthsPreliminary,
      },
    };

    session.history.push(reply);
    session.updatedAt = new Date().toISOString();

    return { session, reply };
  }

  /**
   * Aquí vivía una segunda máquina de estados conversacional que recolectaba
   * slots por su cuenta y emitía su propia cotización formal
   * (`processMessage`, `selectAgeDropdown`, `handleAgeSelection`,
   * `generateFormalQuote`).
   *
   * Se eliminó por dos razones:
   *
   *   1. Era un cotizador paralelo. Nuquí, en el frontend, conduce la
   *      secuencia y le pide las cifras a POST /v1/pricing/calculate-quote.
   *      Tener dos flujos significaba dos narrativas de precio: aquella
   *      seguía anunciando el 5% por esterilización que ya no existe y una
   *      vigencia de 15 días donde Nuquí dice 7.
   *
   *   2. `generateFormalQuote` inventaba los datos que le faltaran
   *      (`ageInMonths || 12`, `city || 'BOGOTA'`, `breedCode ||
   *      'MIXED_BREED_DOG'`) y emitía una cotización real con ellos. Una
   *      póliza tarifada sobre una raza y una ciudad supuestas es un riesgo
   *      técnico y legal, no un valor por defecto.
   *
   * Este módulo hace ahora solo lo que Nuquí le pide: abrir la sesión y
   * analizar la foto. Las cifras las pone el motor actuarial.
   */

}
