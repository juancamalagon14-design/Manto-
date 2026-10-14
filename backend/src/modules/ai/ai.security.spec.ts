import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CITY_FACTORS } from '../pricing/pricing.constants';
import { AiChatService } from './ai-chat.service';
import { AiController } from './ai.controller';
import { AGE_DROPDOWN_OPTIONS } from './ai.types';
import { SendLivePhotoDto, StartChatDto } from './dto/chat.dto';
import { GeminiProvider, MockGeminiProvider } from './gemini.provider';

describe('AiModule - Auditoría Rigurosa y Pruebas Adversarias de Seguridad (Sensor de Visión Nuquí)', () => {
  let controller: AiController;
  let service: AiChatService;
  let geminiProvider: GeminiProvider;
  let validationPipe: ValidationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        AiChatService,
        {
          provide: GeminiProvider,
          useClass: MockGeminiProvider,
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
    service = module.get<AiChatService>(AiChatService);
    geminiProvider = module.get<GeminiProvider>(GeminiProvider);

    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  // =========================================================================
  // VECTOR 1: CUMPLIMIENTO ESTRICTO DE LA RESTRICCIÓN DE CÁMARA (ANTI-FRAUDE)
  // =========================================================================
  describe('Vector 1: Cumplimiento Estricto de la Restricción de Cámara (Anti-Fraude)', () => {
    it('debe rechazar con 400 Bad Request cualquier intento de enviar fotos con isLiveCapture: false (bloqueo de fotos de disco/galería)', async () => {
      const { session } = service.startChat();

      // Intento en capa de servicio
      await expect(
        service.processLivePhoto(session.sessionId, {
          imageBase64: 'BASE64_STREAM_FRAME_PHOTO_DATA_MINIMUM_50_CHARS_LONG_TEST',
          isLiveCapture: false,
        }),
      ).rejects.toThrow(BadRequestException);

      // Intento en capa de controlador HTTP
      await expect(
        controller.processLivePhoto(session.sessionId, {
          imageBase64: 'BASE64_STREAM_FRAME_PHOTO_DATA_MINIMUM_50_CHARS_LONG_TEST',
          isLiveCapture: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe incluir mensaje explicativo sobre la restricción estricta de suscripción y antifraude', async () => {
      const { session } = service.startChat();

      try {
        await service.processLivePhoto(session.sessionId, {
          imageBase64: 'BASE64_STREAM_FRAME_PHOTO_DATA_MINIMUM_50_CHARS_LONG_TEST',
          isLiveCapture: false,
        });
        fail('Debió lanzar BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('restricciones estrictas de suscripción y verificación antifraude');
        expect(err.message).toContain('No se permiten fotos adjuntas de disco ni de galería');
      }
    });

    it('debe rechazar a nivel DTO payloads donde isLiveCapture esté ausente, sea nulo o no booleano', async () => {
      // 1. Ausente
      const missingFlagPayload = {
        imageBase64: 'VALID_BASE64_LONGER_THAN_50_CHARACTERS_FOR_TESTING_PURPOSES',
      };
      await expect(
        validationPipe.transform(missingFlagPayload, {
          type: 'body',
          metatype: SendLivePhotoDto,
        }),
      ).rejects.toThrow(BadRequestException);

      // 2. Tipo string "true" en vez de booleano
      const stringFlagPayload = {
        imageBase64: 'VALID_BASE64_LONGER_THAN_50_CHARACTERS_FOR_TESTING_PURPOSES',
        isLiveCapture: 'true',
      };
      await expect(
        validationPipe.transform(stringFlagPayload, {
          type: 'body',
          metatype: SendLivePhotoDto,
        }),
      ).rejects.toThrow(BadRequestException);

      // 3. Tipo numérico 1 en vez de booleano
      const numberFlagPayload = {
        imageBase64: 'VALID_BASE64_LONGER_THAN_50_CHARACTERS_FOR_TESTING_PURPOSES',
        isLiveCapture: 1,
      };
      await expect(
        validationPipe.transform(numberFlagPayload, {
          type: 'body',
          metatype: SendLivePhotoDto,
        }),
      ).rejects.toThrow(BadRequestException);

      // 4. Null
      const nullFlagPayload = {
        imageBase64: 'VALID_BASE64_LONGER_THAN_50_CHARACTERS_FOR_TESTING_PURPOSES',
        isLiveCapture: null,
      };
      await expect(
        validationPipe.transform(nullFlagPayload, {
          type: 'body',
          metatype: SendLivePhotoDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar payloads con imageBase64 vacío, con sólo espacios o ausente', async () => {
      const { session } = service.startChat();

      // Espacios en blanco
      await expect(
        service.processLivePhoto(session.sessionId, {
          imageBase64: '    ',
          isLiveCapture: true,
        }),
      ).rejects.toThrow(BadRequestException);

      // Cadena vacía
      await expect(
        service.processLivePhoto(session.sessionId, {
          imageBase64: '',
          isLiveCapture: true,
        }),
      ).rejects.toThrow(BadRequestException);

      // A nivel DTO (ausente)
      await expect(
        validationPipe.transform(
          { isLiveCapture: true },
          { type: 'body', metatype: SendLivePhotoDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar fotos sin mascota visible, borrosas o con múltiples animales sin avanzar de estado', async () => {
      const { session } = service.startChat();

      // 1. Frame sin mascota
      const emptyFrameResult = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'NO_PET_DETECTED_IN_THIS_FRAME_SAMPLE_STREAM_LONGER_THAN_50_CHARS',
        isLiveCapture: true,
      });

      expect(emptyFrameResult.session.slots.isLiveCaptureValidated).toBeUndefined();
      expect(emptyFrameResult.reply.text).toContain('No se detectó una mascota');
      expect(emptyFrameResult.reply.inputType).toBe('mode_selection');
      expect(emptyFrameResult.session.currentStep).not.toBe('POST_PHOTO_AGE_VERIFICATION');

      // 2. Foto borrosa / baja iluminación
      const blurResult = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'BLUR_IMAGE_FRAME_STREAM_SAMPLE_LONGER_THAN_50_CHARS',
        isLiveCapture: true,
      });

      expect(blurResult.reply.text).toContain('borrosa');
      expect(blurResult.session.currentStep).not.toBe('POST_PHOTO_AGE_VERIFICATION');

      // 3. Múltiples mascotas
      const multiResult = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'MULTIPLE_PETS_IMAGE_FRAME_STREAM_SAMPLE_LONGER_THAN_50_CHARS',
        isLiveCapture: true,
      });

      expect(multiResult.reply.text).toContain('más de una mascota');
      expect(multiResult.session.currentStep).not.toBe('POST_PHOTO_AGE_VERIFICATION');
    });

    it('debe fijar isLiveCaptureValidated = true ÚNICAMENTE cuando la captura en vivo es procesada exitosamente', async () => {
      const { session } = service.startChat();
      expect(session.slots.isLiveCaptureValidated).toBeUndefined();

      const { session: afterPhoto } = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'VALID_CANINE_PET_PHOTO_FRAME_SAMPLE_STREAM_LONGER_THAN_50_CHARS',
        isLiveCapture: true,
      });

      expect(afterPhoto.slots.isLiveCaptureValidated).toBe(true);
    });
  });

  // =========================================================================
  // VECTOR 2: CUMPLIMIENTO DE LA PREGUNTA OBLIGATORIA DE EDAD (MUST)
  // =========================================================================
  describe('Vector 2: Cumplimiento de la Pregunta Obligatoria de Edad (MUST)', () => {
    it('debe transicionar OBLIGATORIAMENTE a POST_PHOTO_AGE_VERIFICATION tras captura de foto válida', async () => {
      const { session } = service.startChat();

      const result = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'VALID_CANINE_PET_PHOTO_FRAME_SAMPLE_STREAM_LONGER_THAN_50_CHARS',
        isLiveCapture: true,
      });

      expect(result.session.currentStep).toBe('POST_PHOTO_AGE_VERIFICATION');
      expect(result.reply.inputType).toBe('age_dropdown');
      expect(result.reply.options).toBeDefined();
    });

    it('debe verificar la integridad completa del catálogo AGE_DROPDOWN_OPTIONS (2 a 144 meses asegurables, extremos no asegurables)', () => {
      const options = service.getAgeDropdownOptions();

      // Debe haber exactamente 2 opciones inelegibles con flags
      const under2 = options.find((o) => o.id === 'UNDER_2_MONTHS');
      const over12 = options.find((o) => o.id === 'OVER_12_YEARS');

      expect(under2).toBeDefined();
      expect(under2?.isEligible).toBe(false);
      expect(under2?.warningFlag).toBe('UNDER_MIN_AGE');

      expect(over12).toBeDefined();
      expect(over12?.isEligible).toBe(false);
      expect(over12?.warningFlag).toBe('OVER_MAX_AGE');

      // Cachorros elegibles
      expect(options.find((o) => o.id === '2_MONTHS')?.ageInMonths).toBe(2);
      expect(options.find((o) => o.id === '6_MONTHS')?.ageInMonths).toBe(6);

      // Adultos elegibles
      expect(options.find((o) => o.id === '1_YEAR')?.ageInMonths).toBe(12);
      expect(options.find((o) => o.id === '12_YEARS')?.ageInMonths).toBe(144);
    });
  });

  // =========================================================================
  // VECTOR 3: AISLAMIENTO DE SESIÓN Y MANIPULACIÓN (SESSION SECURITY)
  // =========================================================================
  describe('Vector 3: Aislamiento de Sesión y Manipulación', () => {
    it('debe rechazar inyección de propiedades no autorizadas en StartChatDto (Mass Assignment)', async () => {
      const maliciousStartPayload = {
        mode: 'LIVE_CAMERA',
        customerName: 'Hacker',
        role: 'SUPERADMIN', // Campo no permitido
        bypassAgeCheck: true,
        overrideBasePremium: 0,
      };

      await expect(
        validationPipe.transform(maliciousStartPayload, {
          type: 'body',
          metatype: StartChatDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe responder con 404 NotFoundException ante cualquier operación con un sessionId inexistente', async () => {
      const nonExistentId = 'f8a4b6c2-0000-0000-0000-000000000000';

      // 1. getSession
      expect(() => controller.getSession(nonExistentId)).toThrow(NotFoundException);
      expect(() => service.getSession(nonExistentId)).toThrow(NotFoundException);

      // 2. processLivePhoto
      await expect(
        controller.processLivePhoto(nonExistentId, {
          imageBase64: 'VALID_BASE64_LONG_ENOUGH_FOR_TESTING_SESSION_NOT_FOUND',
          isLiveCapture: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe mantener aislamiento estricto entre sesiones concurrentes (no contaminación cruzada)', async () => {
      const session1 = service.startChat({ mode: 'LIVE_CAMERA', customerName: 'Usuario 1' });
      const session2 = service.startChat({ mode: 'INITIAL_SELECTION', customerName: 'Usuario 2' });

      expect(session1.session.sessionId).not.toBe(session2.session.sessionId);
      expect(session1.session.mode).toBe('LIVE_CAMERA');
      expect(session2.session.mode).toBe('INITIAL_SELECTION');

      const fetched1 = service.getSession(session1.session.sessionId);
      const fetched2 = service.getSession(session2.session.sessionId);

      expect(fetched1.slots.customerName).toBe('Usuario 1');
      expect(fetched2.slots.customerName).toBe('Usuario 2');
    });

    it('debe entregar copias inmutables del estado de la sesión (anti-tampering)', () => {
      const { session } = service.startChat();
      const fetched = service.getSession(session.sessionId);

      // Mutar la copia retornada
      (fetched.slots as any).injectedProperty = 'MALICIOUS_DATA';

      // Verificar que el estado original interno no se vio alterado
      const refetched = service.getSession(session.sessionId);
      expect((refetched.slots as any).injectedProperty).toBeUndefined();
    });
  });

  // =========================================================================
  // VECTOR 4: LOCALIZACIÓN Y NORMALIZACIÓN DE MAPS
  // =========================================================================
  describe('Vector 4: Localización y Normalización de Maps', () => {
    it('debe clasificar correctamente coordenadas dentro del cuadrante de Bogotá D.C. y aplicar factor actuarial 1.08', async () => {
      const bogotaCoords = [
        { latitude: 4.5981, longitude: -74.076 }, // Plaza de Bolívar
        { latitude: 4.6768, longitude: -74.0483 }, // Parque 93 / Chapinero
        { latitude: 4.7011, longitude: -74.0322 }, // Usaquén
        { latitude: 4.745, longitude: -74.088 }, // Suba
      ];

      for (const coords of bogotaCoords) {
        const city = await geminiProvider.parseLocation('', coords);
        expect(city).toBe('BOGOTA');
        expect(CITY_FACTORS[city]).toBe(1.08);
      }
    });

    it('debe clasificar correctamente coordenadas dentro del Valle de Aburrá (Medellín) y aplicar factor actuarial 1.04', async () => {
      const medellinCoords = [
        { latitude: 6.2089, longitude: -75.5684 }, // El Poblado
        { latitude: 6.2435, longitude: -75.5906 }, // Laureles
        { latitude: 6.1709, longitude: -75.5828 }, // Envigado
        { latitude: 6.2518, longitude: -75.5636 }, // Centro Medellín
      ];

      for (const coords of medellinCoords) {
        const city = await geminiProvider.parseLocation('', coords);
        expect(city).toBe('MEDELLIN');
        expect(CITY_FACTORS[city]).toBe(1.04);
      }
    });

    it('debe clasificar correctamente coordenadas dentro de Santiago de Cali y aplicar factor actuarial 1.00', async () => {
      const caliCoords = [
        { latitude: 3.4475, longitude: -76.5401 }, // San Antonio
        { latitude: 3.4568, longitude: -76.536 }, // Granada
        { latitude: 3.375, longitude: -76.532 }, // Ciudad Jardín
      ];

      for (const coords of caliCoords) {
        const city = await geminiProvider.parseLocation('', coords);
        expect(city).toBe('CALI');
        expect(CITY_FACTORS[city]).toBe(1.0);
      }
    });

    it('debe clasificar como OTHER coordenadas de otros municipios colombianos y del exterior con factor actuarial 0.95', async () => {
      const otherCoords = [
        { latitude: 7.1193, longitude: -73.1227 }, // Bucaramanga
        { latitude: 10.9685, longitude: -74.7813 }, // Barranquilla
        { latitude: 10.391, longitude: -75.4794 }, // Cartagena
        { latitude: 4.8133, longitude: -75.6961 }, // Pereira
        { latitude: 5.0689, longitude: -75.5174 }, // Manizales
        { latitude: 1.2136, longitude: -77.2811 }, // Pasto
        { latitude: 40.7128, longitude: -74.006 }, // New York (fuera de Colombia)
      ];

      for (const coords of otherCoords) {
        const city = await geminiProvider.parseLocation('', coords);
        expect(city).toBe('OTHER');
        expect(CITY_FACTORS[city]).toBe(0.95);
      }
    });

    it('debe normalizar correctamente texto de ubicación con variantes ortográficas y acentos', async () => {
      expect(await geminiProvider.parseLocation('Bogotá D.C.')).toBe('BOGOTA');
      expect(await geminiProvider.parseLocation('bogota')).toBe('BOGOTA');
      expect(await geminiProvider.parseLocation('Cundinamarca')).toBe('BOGOTA');

      expect(await geminiProvider.parseLocation('Medellín')).toBe('MEDELLIN');
      expect(await geminiProvider.parseLocation('medellin, antioquia')).toBe('MEDELLIN');
      expect(await geminiProvider.parseLocation('Envigado')).toBe('MEDELLIN');
      expect(await geminiProvider.parseLocation('El Poblado')).toBe('MEDELLIN');

      expect(await geminiProvider.parseLocation('Cali')).toBe('CALI');
      expect(await geminiProvider.parseLocation('Santiago de Cali')).toBe('CALI');
      expect(await geminiProvider.parseLocation('Valle del Cauca')).toBe('CALI');

      expect(await geminiProvider.parseLocation('Bucaramanga, Santander')).toBe('OTHER');
      expect(await geminiProvider.parseLocation('Cartagena de Indias')).toBe('OTHER');
    });
  });

  // =========================================================================
  // VECTOR 5: PROTECCIÓN CONTRA EVASIÓN DE LEY 1801 (RCE 50 SMLMV)
  // =========================================================================
  describe('Vector 5: Protección Contra Evasión de Ley 1801 de 2016', () => {
    it('debe marcar requiresBreedConfirmation = true cuando la confianza de detección es baja (< 0.60)', async () => {
      const { session } = service.startChat();

      // Foto sintética desconocida o binario real que degrada a MIXED_BREED_DOG con confianza 0.20
      const result = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'UNKNOWN_OR_DEGRADED_PHOTO_BASE64_DATA_STRING_LONG_ENOUGH_FOR_TEST',
        isLiveCapture: true,
      });

      expect(result.reply.metadata?.requiresBreedConfirmation).toBe(true);
      expect(result.reply.metadata?.confidence).toBeLessThan(0.60);
      expect(result.reply.text).toContain('No logré reconocer bien la raza en la foto, así que la confirmamos contigo más adelante');
    });

    it('debe detectar correctamente razas de manejo especial bajo Ley 1801 cuando la toma es clara', async () => {
      const { session } = service.startChat();

      const result = await service.processLivePhoto(session.sessionId, {
        imageBase64: 'CANINE_PITBULL_SAMPLE_STREAM_LONGER_THAN_50_CHARS_TEST',
        isLiveCapture: true,
      });

      expect(result.session.slots.breedCode).toBe('AMERICAN_PIT_BULL_TERRIER');
      expect(result.reply.metadata?.detectedBreed).toBe('American Pit Bull Terrier');
      expect(result.reply.metadata?.requiresBreedConfirmation).toBe(false);
      expect(result.reply.text).toContain('American Pit Bull Terrier');
    });
  });
});
