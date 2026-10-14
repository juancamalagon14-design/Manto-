import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiChatService } from './ai-chat.service';
import { GeminiProvider, MockGeminiProvider } from './gemini.provider';

describe('AiChatService (Sensor de Visión y Sesión Conversacional Nuquí)', () => {
  let service: AiChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChatService,
        {
          provide: GeminiProvider,
          useClass: MockGeminiProvider,
        },
      ],
    }).compile();

    service = module.get<AiChatService>(AiChatService);
  });

  describe('Doctrina Manto 2.0: IA como Sensor Estricto de Extracción', () => {
    it('el servicio de chat NO debe calcular primas ni cotizar pólizas (Doctrina IA)', () => {
      // Verifica que AiChatService no tenga acoplamiento ni métodos de cálculo actuarial
      expect((service as any).generateFormalQuote).toBeUndefined();
      expect((service as any).calculatePremium).toBeUndefined();
    });
  });

  describe('Inicio de Chat y Bienvenida (Nuquí)', () => {
    it('debe saludar con Nuquí y ofrecer bifurcación Foto vs Chat', () => {
      const { session, welcomeMessage } = service.startChat();

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.currentStep).toBe('SELECT_MODE');
      expect(welcomeMessage.sender).toBe('assistant');
      expect(welcomeMessage.text).toContain('Soy Nuquí, de Manto');

      const optionValues = welcomeMessage.options?.map((o) => o.value);
      expect(optionValues).toContain('LIVE_CAMERA');
      expect(optionValues).toContain('CHAT');
    });

    it('debe permitir inicializar directamente en modo LIVE_CAMERA', () => {
      const cameraInit = service.startChat({ mode: 'LIVE_CAMERA' });
      expect(cameraInit.session.currentStep).toBe('CAMERA_CAPTURE');
      expect(cameraInit.welcomeMessage.inputType).toBe('camera_capture');
    });

    it('debe retornar las opciones de edad para el desplegable (getAgeDropdownOptions)', () => {
      const options = service.getAgeDropdownOptions();
      expect(options).toBeDefined();
      expect(options.length).toBeGreaterThan(10);

      const optionIds = options.map((o) => o.id);
      expect(optionIds).toContain('2_MONTHS');
      expect(optionIds).toContain('1_YEAR');
      expect(optionIds).toContain('10_YEARS');
      expect(optionIds).toContain('UNDER_2_MONTHS');
      expect(optionIds).toContain('OVER_12_YEARS');
    });
  });

  describe('Restricción Estricta de Cámara (isLiveCapture)', () => {
    it('debe rechazar fotos si isLiveCapture es false (bloqueo de fotos de disco/galería)', async () => {
      const { session } = service.startChat();

      await expect(
        service.processLivePhoto(session.sessionId, {
          imageBase64: 'BASE64_FROM_GALLERY_ATTACHMENT',
          isLiveCapture: false,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.processLivePhoto(session.sessionId, {
          imageBase64: 'BASE64_FROM_GALLERY_ATTACHMENT',
          isLiveCapture: false,
        }),
      ).rejects.toThrow(/únicamente se admiten capturas de cámara tomadas en vivo/i);
    });

    it('debe rechazar fotos con payload base64 vacío', async () => {
      const { session } = service.startChat();

      await expect(
        service.processLivePhoto(session.sessionId, {
          imageBase64: '   ',
          isLiveCapture: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Flujo de Cámara en Vivo con Verificación de Edad Obligatoria (MUST)', () => {
    it('debe procesar foto en vivo y transicionar OBLIGATORIAMENTE a POST_PHOTO_AGE_VERIFICATION con selector desplegable', async () => {
      const { session } = service.startChat();

      const { session: updatedSession, reply } = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'VALID_LIVE_STREAM_FRAME_PHOTO_OF_A_GOLDEN_RETRIEVER_DOG_MIN_50_CHARS_LONG',
        isLiveCapture: true,
      });

      expect(updatedSession.mode).toBe('LIVE_CAMERA');
      // MUST: Verificación obligatoria post-foto
      expect(updatedSession.currentStep).toBe('POST_PHOTO_AGE_VERIFICATION');
      expect(updatedSession.slots.breedCode).toBe('GOLDEN_RETRIEVER');
      expect(updatedSession.slots.isLiveCaptureValidated).toBe(true);

      expect(reply.inputType).toBe('age_dropdown');
      expect(reply.text).toContain('Golden Retriever');
      expect(reply.options).toBeDefined();
      expect(reply.options!.length).toBeGreaterThan(10);
    });

    it('debe marcar requiresBreedConfirmation si la confianza de detección es menor a 0.6', async () => {
      const { session } = service.startChat();

      // En el MockGeminiProvider, cualquier texto que no haga match con razas específicas da confidence 0.2
      const { reply } = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'UNRECOGNIZED_PET_PICTURE_LOW_CONFIDENCE_MIN_50_CHARS_LONG_OK',
        isLiveCapture: true,
      });

      expect(reply.metadata?.requiresBreedConfirmation).toBe(true);
      expect(reply.metadata?.confidence).toBeLessThan(0.6);
      expect(reply.text).toContain('No logré reconocer bien la raza en la foto');
    });

    it('debe manejar gracefully fotos donde no se detecta mascota', async () => {
      const { session } = service.startChat();

      const { session: updatedSession, reply } = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'EMPTY_FRAME_NO_PET_MIN_50_CHARS_LONG_TEST_PAYLOAD_DATA',
        isLiveCapture: true,
      });

      expect(reply.options?.some((o) => o.value === 'RETRY')).toBe(true);
      expect(reply.options?.some((o) => o.value === 'CHAT')).toBe(true);
    });
  });

  describe('Habeas Data (Ley 1581 de 2012) & Seguridad', () => {
    it('getSession debe devolver una copia inmutable (structuredClone)', () => {
      const { session } = service.startChat({ customerName: 'Camila Perez' });
      const retrieved = service.getSession(session.sessionId);

      expect(retrieved.sessionId).toBe(session.sessionId);
      expect(retrieved.slots.customerName).toBe('Camila Perez');

      // Modificar la copia devuelta no debe mutar el estado en el servidor
      retrieved.slots.customerName = 'Nombre Modificado';
      const retrievedAgain = service.getSession(session.sessionId);
      expect(retrievedAgain.slots.customerName).toBe('Camila Perez');
    });

    it('debe lanzar NotFoundException si la sesión no existe', () => {
      expect(() => service.getSession('session-inexistente-123')).toThrow(NotFoundException);
    });

    it('debe purgar sesiones que superan el TTL de retención de 2 horas (Habeas Data)', () => {
      const { session } = service.startChat({ customerName: 'Dato Privado' });

      // Simular que pasaron más de 2 horas (2 * 60 * 60 * 1000 + 1000 ms)
      const expiredTime = new Date(Date.now() - (2 * 60 * 60 * 1000 + 5000)).toISOString();
      (service as any).sessions.get(session.sessionId).updatedAt = expiredTime;

      // El acceso posterior debe purgar la sesión vencida
      expect(() => service.getSession(session.sessionId)).toThrow(NotFoundException);
    });
  });
});
