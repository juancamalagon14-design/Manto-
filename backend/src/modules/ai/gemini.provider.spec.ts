import { GeminiProvider, MockGeminiProvider, RealGeminiProvider } from './gemini.provider';

describe('GeminiProvider (Dual Adapter & Fallback Engine)', () => {
  let provider: GeminiProvider;
  let mockProvider: MockGeminiProvider;

  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    provider = new GeminiProvider();
    mockProvider = new MockGeminiProvider();
  });

  afterAll(() => {
    if (originalKey !== undefined) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  describe('Dual Adapter Behavior', () => {
    it('debe operar con MockGeminiProvider si GEMINI_API_KEY no está configurada o es mock', () => {
      expect(provider.isUsingMock()).toBe(true);
    });

    it('debe instanciar RealGeminiProvider si existe API key y reflejar isUsingMock() = false', () => {
      const real = new RealGeminiProvider('AIzaSyTestValidKey12345');
      expect(real.isUsingMock()).toBe(false);
    });
  });

  describe('analyzeLivePhoto (Multimodal Vision Analysis)', () => {
    it('debe detectar raza canina por defecto (Golden Retriever) con alta confianza', async () => {
      const result = await provider.analyzeLivePhoto('BASE64_VALID_DOG_PHOTO_STREAM_SAMPLE_LONG_ENOUGH_TO_PASS_50_CHARS');
      expect(result.isValidLivePhoto).toBe(true);
      expect(result.petDetected).toBe(true);
      expect(result.species).toBe('CANINE');
      expect(result.breedCode).toBe('GOLDEN_RETRIEVER');
      expect(result.breedName).toBe('Golden Retriever');
      expect(result.sizeCategory).toBe('LARGE');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('debe detectar felino cuando el frame contiene indicadores de gato o siamés', async () => {
      const result = await provider.analyzeLivePhoto('FRAME_CONTAINING_FELINE_SIAMESE_CAT_SAMPLE_STREAM_LONGER_THAN_50_CHARS');
      expect(result.isValidLivePhoto).toBe(true);
      expect(result.petDetected).toBe(true);
      expect(result.species).toBe('FELINE');
      expect(result.breedCode).toBe('SIAMESE');
      expect(result.breedName).toBe('Siamés');
      expect(result.sizeCategory).toBe('SMALL');
    });

    it('debe detectar perro criollo / mestizo cuando el frame indica mixed', async () => {
      const result = await provider.analyzeLivePhoto('FRAME_CONTAINING_CRIOLLO_MIXED_DOG_SAMPLE_LONGER_THAN_50_CHARS');
      expect(result.isValidLivePhoto).toBe(true);
      expect(result.petDetected).toBe(true);
      expect(result.breedCode).toBe('MIXED_BREED_DOG');
      expect(result.breedName).toBe('Criollo / Mestizo');
    });

    it('debe rechazar fotos sin mascota visible o frames vacíos', async () => {
      const result = await provider.analyzeLivePhoto('NO_PET_IN_THIS_FRAME_SAMPLE_STREAM_LONGER_THAN_50_CHARS');
      expect(result.petDetected).toBe(false);
      expect(result.errorReason).toBeDefined();
      expect(result.errorReason).toContain('No se detectó una mascota');
    });

    it('debe rechazar fotos borrosas o con iluminación deficiente', async () => {
      const result = await provider.analyzeLivePhoto('BLUR_IMAGE_FRAME_STREAM_SAMPLE_LONGER_THAN_50_CHARS');
      expect(result.petDetected).toBe(false);
      expect(result.errorReason).toContain('borrosa');
    });

    it('debe rechazar tomas con múltiples mascotas simultáneas', async () => {
      const result = await provider.analyzeLivePhoto('MULTIPLE_PETS_IMAGE_FRAME_STREAM_SAMPLE_LONGER_THAN_50_CHARS');
      expect(result.petDetected).toBe(false);
      expect(result.errorReason).toContain('más de una mascota');
    });

    it('debe degradar a mestizo con baja confianza (0.2) en modo mock ante fotos binarias reales para forzar confirmación humana (Ley 1801)', async () => {
      const realBinaryPhotoBase64 = Buffer.alloc(1200, 'dog_photo_binary_data_without_synthetic_tags').toString('base64');
      const result = await mockProvider.analyzeLivePhoto(realBinaryPhotoBase64);
      expect(result.isValidLivePhoto).toBe(true);
      expect(result.petDetected).toBe(true);
      expect(result.breedCode).toBe('MIXED_BREED_DOG');
      expect(result.confidence).toBeLessThanOrEqual(0.2);
    });
  });

  describe('parseBreedAndFeatures', () => {
    it('debe identificar razas comunes del catálogo colombiano', async () => {
      const schnauzer = await provider.parseBreedAndFeatures('Tengo un schnauzer');
      expect(schnauzer.breedCode).toBe('SCHNAUZER');
      expect(schnauzer.sizeCategory).toBe('SMALL');

      const frenchie = await provider.parseBreedAndFeatures('Es un bulldog frances hermoso');
      expect(frenchie.breedCode).toBe('FRENCH_BULLDOG');
      expect(frenchie.sizeCategory).toBe('SMALL');

      const pitbull = await provider.parseBreedAndFeatures('Es un pitbull de 2 años');
      expect(pitbull.breedCode).toBe('AMERICAN_PIT_BULL_TERRIER');
    });

    it('debe identificar tamaño para mestizos criollos según descripción', async () => {
      const criolloGrande = await provider.parseBreedAndFeatures('Es un perro criollo grande de orejas caídas');
      expect(criolloGrande.breedCode).toBe('MIXED_BREED_DOG');
      expect(criolloGrande.sizeCategory).toBe('LARGE');

      const criolloChiquito = await provider.parseBreedAndFeatures('Es mestizo chiquito');
      expect(criolloChiquito.breedCode).toBe('MIXED_BREED_DOG');
      expect(criolloChiquito.sizeCategory).toBe('SMALL');
    });

    it('debe identificar felinos y sus razas', async () => {
      const persa = await provider.parseBreedAndFeatures('Tengo un gato persa blanco');
      expect(persa.species).toBe('FELINE');
      expect(persa.breedCode).toBe('PERSIAN');
    });
  });

  describe('parseLocation', () => {
    it('debe normalizar coordenadas GPS a ciudades colombianas', async () => {
      // Bogotá (aprox 4.71, -74.07)
      const bogota = await provider.parseLocation('', { latitude: 4.711, longitude: -74.072 });
      expect(bogota).toBe('BOGOTA');

      // Medellín (aprox 6.24, -75.58)
      const medellin = await provider.parseLocation('', { latitude: 6.244, longitude: -75.581 });
      expect(medellin).toBe('MEDELLIN');

      // Cali (aprox 3.45, -76.53)
      const cali = await provider.parseLocation('', { latitude: 3.451, longitude: -76.532 });
      expect(cali).toBe('CALI');

      // Otra ciudad (ej. Bucaramanga aprox 7.12, -73.11)
      const bucaramanga = await provider.parseLocation('', { latitude: 7.125, longitude: -73.119 });
      expect(bucaramanga).toBe('OTHER');
    });

    it('debe normalizar texto de ciudades con o sin tildes', async () => {
      expect(await provider.parseLocation('Vivo en Bogotá D.C.')).toBe('BOGOTA');
      expect(await provider.parseLocation('Medellin, Antioquia')).toBe('MEDELLIN');
      expect(await provider.parseLocation('Cali, Valle del Cauca')).toBe('CALI');
      expect(await provider.parseLocation('Cartagena')).toBe('OTHER');
    });
  });

  describe('parseSterilization', () => {
    it('debe reconocer afirmaciones de esterilización', async () => {
      expect(await provider.parseSterilization('si')).toBe(true);
      expect(await provider.parseSterilization('Sí, está esterilizado')).toBe(true);
      expect(await provider.parseSterilization('Ya está castrada y operada')).toBe(true);
    });

    it('debe reconocer negaciones de esterilización', async () => {
      expect(await provider.parseSterilization('no')).toBe(false);
      expect(await provider.parseSterilization('Aún no, está entero')).toBe(false);
      expect(await provider.parseSterilization('Todavía no')).toBe(false);
    });
  });

  describe('extractPetName', () => {
    it('debe extraer el nombre de la mascota limpiando frases comunes', async () => {
      expect(await provider.extractPetName('Mi perro se llama Toby')).toBe('Toby');
      expect(await provider.extractPetName('Su nombre es Luna')).toBe('Luna');
      expect(await provider.extractPetName('Rocky')).toBe('Rocky');
    });
  });
});
