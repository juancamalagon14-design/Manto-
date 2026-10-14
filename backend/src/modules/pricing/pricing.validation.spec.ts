import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CalculateQuoteDto } from './dto/calculate-quote.dto';
import { CreateQuoteDto } from '../quotes/dto/create-quote.dto';

/**
 * Pruebas de la frontera de entrada.
 *
 * Reproducen exactamente lo que hace el `ValidationPipe` global de `main.ts`
 * (`whitelist`, `forbidNonWhitelisted`, `transform`), porque el defecto más
 * caro de la auditoría vivía justo ahí: siete campos alias validados con
 * `@ValidateIf(o => o.otro === undefined)` permitían que, enviando el campo
 * canónico Y su alias a la vez, ninguno de los dos se validara.
 *
 * Con `{"deductiblePercentage": 0, "deductible": 0}` la API respondía 200 y
 * congelaba en el snapshot un copago del 0% cobrado al precio del 15%.
 */
const validar = <T extends object>(clase: new () => T, cuerpo: Record<string, unknown>) => {
  const dto = plainToInstance(clase, cuerpo, { enableImplicitConversion: false });
  const errores = validateSync(dto as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return {
    dto,
    ok: errores.length === 0,
    mensajes: errores.flatMap((e) => Object.values(e.constraints ?? {})),
  };
};

const cuerpoValido = {
  species: 'CANINE',
  breedCode: 'MIXED_BREED_DOG',
  sizeCategory: 'MEDIUM',
  ageInMonths: 36,
  city: 'BOGOTA',
  gender: 'MALE',
  isSterilized: false,
  deductiblePercentage: 0.15,
  selectedAddonKeys: [],
  billingFrequency: 'MONTHLY',
};

describe('CalculateQuoteDto — frontera de entrada', () => {
  it('acepta un cuerpo canónico completo', () => {
    const { ok, mensajes } = validar(CalculateQuoteDto, cuerpoValido);
    expect(mensajes).toEqual([]);
    expect(ok).toBe(true);
  });

  describe('los campos alias ya no existen, así que no hay bypass', () => {
    it.each([
      ['deductible', 0],
      ['breed', 'MIXED_BREED_DOG'],
      ['size', 'MEDIUM'],
      ['ageMonths', 36],
      ['age', 36],
      ['sterilized', true],
      ['addons', []],
    ])('rechaza el alias %s en vez de saltarse la validación', (alias, valor) => {
      const { ok, mensajes } = validar(CalculateQuoteDto, { ...cuerpoValido, [alias]: valor });
      expect(ok).toBe(false);
      expect(mensajes.join(' ')).toContain(alias);
    });

    it('el caso exacto del bypass: deducible 0 con su alias ya no pasa', () => {
      const { ok } = validar(CalculateQuoteDto, {
        ...cuerpoValido,
        deductiblePercentage: 0,
        deductible: 0,
      });
      expect(ok).toBe(false);
    });
  });

  describe('deducible', () => {
    it.each([0, 0.05, 0.25, 1, 99, -0.15])('rechaza %s', (valor) => {
      const { ok } = validar(CalculateQuoteDto, {
        ...cuerpoValido,
        deductiblePercentage: valor,
      });
      expect(ok).toBe(false);
    });

    it.each([
      [10, 0.1],
      [15, 0.15],
      [20, 0.2],
    ])('acepta la forma porcentual %s y la normaliza a %s', (entrada, esperado) => {
      const { ok, dto } = validar(CalculateQuoteDto, {
        ...cuerpoValido,
        deductiblePercentage: entrada,
      });
      expect(ok).toBe(true);
      expect(dto.deductiblePercentage).toBe(esperado);
    });

    it('es obligatorio', () => {
      const { deductiblePercentage, ...sinDeducible } = cuerpoValido;
      const { ok } = validar(CalculateQuoteDto, sinDeducible);
      expect(ok).toBe(false);
    });
  });

  describe('ciudad', () => {
    it.each(['BOGOTA', 'bogota', 'Bogotá', ' bogotá '])(
      'normaliza %s a BOGOTA',
      (entrada) => {
        const { ok, dto } = validar(CalculateQuoteDto, { ...cuerpoValido, city: entrada });
        expect(ok).toBe(true);
        expect(dto.city).toBe('BOGOTA');
      },
    );

    it.each(['Bogotá D.C.', 'Bogota, Cundinamarca', 'Suba', 'Zipaquirá', 'Barranquilla'])(
      'rechaza %s en vez de caer al factor más barato',
      (entrada) => {
        // El transform terminaba en `return 'OTHER'`, así que cualquier texto
        // libre no reconocido tarifaba con el factor más bajo del catálogo:
        // −12% sobre la ciudad más costosa de la cartera. Nuquí recolecta
        // texto libre, así que era alcanzable desde el producto.
        const { ok } = validar(CalculateQuoteDto, { ...cuerpoValido, city: entrada });
        expect(ok).toBe(false);
      },
    );
  });

  describe('sexo', () => {
    it('es obligatorio', () => {
      const { gender, ...sinSexo } = cuerpoValido;
      const { ok } = validar(CalculateQuoteDto, sinSexo);
      expect(ok).toBe(false);
    });

    it.each(['OTHER', 'UNKNOWN', '', 'NEUTRO'])('rechaza %s', (valor) => {
      const { ok } = validar(CalculateQuoteDto, { ...cuerpoValido, gender: valor });
      expect(ok).toBe(false);
    });
  });

  describe('edad', () => {
    it.each([1, 0, -5, 145, 200, 1.5])('rechaza %s meses', (valor) => {
      const { ok } = validar(CalculateQuoteDto, { ...cuerpoValido, ageInMonths: valor });
      expect(ok).toBe(false);
    });

    it.each([2, 36, 144])('acepta %s meses', (valor) => {
      const { ok } = validar(CalculateQuoteDto, { ...cuerpoValido, ageInMonths: valor });
      expect(ok).toBe(true);
    });
  });

  describe('mascotas en la póliza', () => {
    it.each([0, -1, 11, 2.5])('rechaza %s', (valor) => {
      const { ok } = validar(CalculateQuoteDto, { ...cuerpoValido, petsInPolicy: valor });
      expect(ok).toBe(false);
    });

    it('es opcional', () => {
      const { ok } = validar(CalculateQuoteDto, cuerpoValido);
      expect(ok).toBe(true);
    });
  });

  describe('tamaño', () => {
    it('es opcional: el motor toma el típico de la raza', () => {
      const { sizeCategory, ...sinTamano } = cuerpoValido;
      const { ok } = validar(CalculateQuoteDto, sinTamano);
      expect(ok).toBe(true);
    });

    it('rechaza una categoría inventada', () => {
      const { ok } = validar(CalculateQuoteDto, { ...cuerpoValido, sizeCategory: 'NANO' });
      expect(ok).toBe(false);
    });
  });

  describe('mass assignment', () => {
    it.each(['createdAt', 'isAdmin', 'quoteNumber', 'status', 'pricingResult'])(
      'rechaza el campo no declarado %s',
      (campo) => {
        const { ok } = validar(CalculateQuoteDto, { ...cuerpoValido, [campo]: 'x' });
        expect(ok).toBe(false);
      },
    );

    it('__proto__ en el cuerpo no contamina el prototipo ni llega al DTO', () => {
      // Se construye con JSON.parse a propósito: el spread de un literal con
      // `__proto__` no crea una propiedad propia, cambia el prototipo, así que
      // no reproduce lo que hace Express al parsear el cuerpo.
      const cuerpo = JSON.parse(
        JSON.stringify(cuerpoValido).replace(/^\{/, '{"__proto__":{"isAdmin":true},'),
      );
      expect(Object.prototype.hasOwnProperty.call(cuerpo, '__proto__')).toBe(true);

      const { ok, dto } = validar(CalculateQuoteDto, cuerpo);

      // `class-transformer` no copia la clave, así que el cuerpo se acepta y
      // la contaminación se queda fuera. Lo que importa no es el 400 sino que
      // la propiedad no exista en el DTO ni en Object.prototype.
      expect(ok).toBe(true);
      expect((dto as unknown as Record<string, unknown>).isAdmin).toBeUndefined();
      expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
      expect(Object.getPrototypeOf(dto)).toBe(CalculateQuoteDto.prototype);
    });
  });

  it('rechaza un add-on que no existe', () => {
    const { ok } = validar(CalculateQuoteDto, {
      ...cuerpoValido,
      selectedAddonKeys: ['COMMON_ILLNESSES', 'COBERTURA_INVENTADA'],
    });
    expect(ok).toBe(false);
  });
});

describe('CreateQuoteDto — valida igual que tarifar, por herencia', () => {
  const cuerpoEmision = { ...cuerpoValido, petName: 'Nala' };

  it('acepta un cuerpo canónico completo', () => {
    const { ok, mensajes } = validar(CreateQuoteDto, cuerpoEmision);
    expect(mensajes).toEqual([]);
    expect(ok).toBe(true);
  });

  it('el nombre de la mascota es obligatorio', () => {
    const { petName, ...sinNombre } = cuerpoEmision;
    const { ok } = validar(CreateQuoteDto, sinNombre);
    expect(ok).toBe(false);
  });

  /**
   * Esta es la prueba que impide que las dos rutas vuelvan a divergir. Eran
   * dos archivos de ~310 líneas declarando los mismos campos por separado, y
   * el bypass de los alias había que arreglarlo dos veces.
   */
  it.each([
    { caso: 'deducible inválido', cuerpo: { deductiblePercentage: 0 } },
    { caso: 'alias de deducible', cuerpo: { deductible: 0.15 } },
    { caso: 'ciudad en texto libre', cuerpo: { city: 'Bogotá D.C.' } },
    { caso: 'sin sexo', cuerpo: { gender: undefined } },
    { caso: 'edad fuera de rango', cuerpo: { ageInMonths: 200 } },
    { caso: 'tamaño inventado', cuerpo: { sizeCategory: 'NANO' } },
    { caso: 'campo no declarado', cuerpo: { isAdmin: true } },
  ])('rechaza $caso igual que CalculateQuoteDto', ({ cuerpo }) => {
    const tarifar = validar(CalculateQuoteDto, { ...cuerpoValido, ...cuerpo });
    const emitir = validar(CreateQuoteDto, { ...cuerpoEmision, ...cuerpo });
    expect(emitir.ok).toBe(tarifar.ok);
    expect(emitir.ok).toBe(false);
  });
});
