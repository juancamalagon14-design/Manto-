import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiChatService } from './ai-chat.service';
import { AiController } from './ai.controller';
import { GeminiProvider } from './gemini.provider';

describe('AiController (REST Endpoints /v1/ai/chat)', () => {
  let controller: AiController;
  let service: AiChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [AiChatService, GeminiProvider],
    }).compile();

    controller = module.get<AiController>(AiController);
    service = module.get<AiChatService>(AiChatService);
  });

  describe('GET /v1/ai/chat/age-options', () => {
    it('debe retornar el catálogo completo de opciones para el selector desplegable de edad', () => {
      const options = controller.getAgeDropdownOptions();
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThanOrEqual(15);
      expect(options.some((o) => o.id === 'UNDER_2_MONTHS')).toBe(true);
      expect(options.some((o) => o.id === 'OVER_12_YEARS')).toBe(true);
      expect(options.some((o) => o.id === '12_YEARS')).toBe(true);
      expect(options.some((o) => o.id === '1_YEAR')).toBe(true);
    });
  });

  describe('POST /v1/ai/chat/start', () => {
    it('debe crear una nueva sesión y responder con saludo cálido de Nuquí', () => {
      const result = controller.startChat({ mode: 'INITIAL_SELECTION' });
      expect(result).toBeDefined();
      expect(result.session.sessionId).toBeDefined();
      expect(result.welcomeMessage.text).toContain('Nuquí');
    });
  });

  describe('POST /v1/ai/chat/:sessionId/live-photo', () => {
    it('debe rechazar si isLiveCapture es false (Restricción estricta de cámara)', async () => {
      const { session } = controller.startChat({});
      await expect(
        controller.processLivePhoto(session.sessionId, {
          imageBase64: 'BASE64_DATA',
          isLiveCapture: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe procesar exitosamente captura en vivo e invocar Gemini Vision', async () => {
      const { session } = controller.startChat({});
      const result = await controller.processLivePhoto(session.sessionId, {
        imageBase64: 'VALID_BASE64_STREAM_FRAME_PHOTO_OF_A_PET_LONGER_THAN_50_CHARS',
        isLiveCapture: true,
      });

      expect(result.session.currentStep).toBe('POST_PHOTO_AGE_VERIFICATION');
      expect(result.reply.inputType).toBe('age_dropdown');
    });
  });

  describe('GET /v1/ai/chat/:sessionId', () => {
    it('debe consultar el estado de una sesión existente', () => {
      const { session } = controller.startChat({ mode: 'INITIAL_SELECTION' });
      const fetched = controller.getSession(session.sessionId);
      expect(fetched.sessionId).toBe(session.sessionId);
      expect(fetched.mode).toBe('INITIAL_SELECTION');
    });

    it('debe lanzar NotFoundException al consultar una sesión inexistente', () => {
      expect(() => controller.getSession('non-existent-session-uuid-12345')).toThrow(
        NotFoundException,
      );
    });
  });
});
