import { EligibilityService } from '../eligibility/eligibility.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { InMemoryQuotesRepository } from './quotes.repository';
import { QuotesService } from './quotes.service';

/**
 * Pruebas de emisión de cotización.
 *
 * Existen porque la intervención cambió qué se congela en el snapshot —el
 * tamaño efectivo en vez del declarado, y `petsInPolicy`— y la prima tiene que
 * seguir siendo reproducible ante la Superintendencia a partir de lo guardado.
 */
describe('QuotesService — emisión de cotización', () => {
  let service: QuotesService;
  let pricing: PricingService;

  const dto = (parcial: Partial<CreateQuoteDto> = {}): CreateQuoteDto =>
    Object.assign(new CreateQuoteDto(), {
      petName: 'Nala',
      species: 'CANINE',
      breedCode: 'MIXED_BREED_DOG',
      ageInMonths: 36,
      city: 'BOGOTA',
      gender: 'MALE',
      isSterilized: false,
      deductiblePercentage: 0.15,
      selectedAddonKeys: [],
      billingFrequency: 'MONTHLY',
      hasPreExistingChronicConditions: false,
      ...parcial,
    });

  beforeEach(() => {
    pricing = new PricingService();
    service = new QuotesService(new EligibilityService(), pricing, new InMemoryQuotesRepository());
  });

  it('congela el tamaño con el que se tarifó, no el que declaró el cliente', async () => {
    // Sin declarar tamaño, el motor toma GIANT del registro del Bullmastiff.
    const q = await service.createQuote(dto({ breedCode: 'BULLMASTIFF' }));
    expect(q.petData.sizeCategory).toBe('GIANT');
    expect(q.pricingResult?.effectiveSizeCategory).toBe('GIANT');
  });

  it('congela petsInPolicy: sin él, el 5% no es reproducible', async () => {
    const q = await service.createQuote(dto({ petsInPolicy: 2 }));
    expect(q.petData.petsInPolicy).toBe(2);
    expect(q.pricingResult?.multiPetDiscountApplied).toBe(true);
  });

  it('congela el deducible y el copago de cada amparo', async () => {
    const q = await service.createQuote(dto({ deductiblePercentage: 0.2 }));
    expect(q.selectedDeductiblePercentage).toBe(0.2);
    for (const c of q.pricingResult!.guaranteedBaselineCoverages) {
      expect(c.copayDeductiblePercentage).toBe(0.2);
    }
  });

  it('los add-ons guardados son los que anexó el motor, no los que pidió el cliente', async () => {
    // El Rottweiler fuerza la RCE de Ley 1801 aunque no se pida.
    const q = await service.createQuote(
      dto({ breedCode: 'ROTTWEILER', selectedAddonKeys: ['TELEMEDICINE'] }),
    );
    expect(q.selectedAddonKeys).toEqual(
      expect.arrayContaining(['TELEMEDICINE', 'CIVIL_LIABILITY_1801']),
    );
  });

  it('una raza fuera del registro se rechaza sin calcular prima', async () => {
    const q = await service.createQuote(dto({ breedCode: 'PITBULL' }));
    expect(q.status).toBe('REJECTED');
    expect(q.pricingResult).toBeNull();
    expect(q.rejectionReasons?.length).toBeGreaterThan(0);
  });

  it('el snapshot leído de vuelta es idéntico al emitido', async () => {
    const q = await service.createQuote(dto({ breedCode: 'ROTTWEILER', petsInPolicy: 2 }));
    const leido = await service.getQuoteById(q.id);
    expect(leido.pricingResult?.totalMonthlyPremiumCop).toBe(
      q.pricingResult?.totalMonthlyPremiumCop,
    );
    expect(leido.petData).toEqual(q.petData);
  });

  it('el snapshot no se puede mutar desde fuera del repositorio', async () => {
    const q = await service.createQuote(dto());
    const leido = await service.getQuoteById(q.id);
    leido.petData.name = 'Otro';
    const releido = await service.getQuoteById(q.id);
    expect(releido.petData.name).toBe('Nala');
  });

  it('la prima guardada coincide con la que el motor recalcula con los datos guardados', async () => {
    // Esta es la prueba de reproducibilidad: con lo que quedó en el snapshot
    // se tiene que poder volver a obtener exactamente la misma prima.
    const q = await service.createQuote(
      dto({ breedCode: 'ROTTWEILER', petsInPolicy: 2, deductiblePercentage: 0.2 }),
    );
    const recalculo = pricing.calculateQuote({
      species: q.petData.species,
      breedCode: q.petData.breedCode,
      sizeCategory: q.petData.sizeCategory,
      ageInMonths: q.petData.ageInMonths,
      city: q.petData.city,
      gender: q.petData.gender,
      petsInPolicy: q.petData.petsInPolicy,
      isSterilized: q.petData.isSterilized,
      deductiblePercentage: q.selectedDeductiblePercentage,
      selectedAddonKeys: q.selectedAddonKeys,
      billingFrequency: q.billingFrequency,
    });
    expect(recalculo.totalMonthlyPremiumCop).toBe(q.pricingResult?.totalMonthlyPremiumCop);
  });
});
