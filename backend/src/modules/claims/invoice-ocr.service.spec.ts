import { Test, TestingModule } from '@nestjs/testing';
import { copToNumber } from '../../common/types/money';
import { GeminiProvider, MockGeminiProvider } from '../ai/gemini.provider';
import { InvoiceOcrService } from './invoice-ocr.service';

describe('InvoiceOcrService (Extracción OCR con Gemini 3.6 Flash)', () => {
  let service: InvoiceOcrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceOcrService,
        {
          provide: GeminiProvider,
          useClass: MockGeminiProvider,
        },
      ],
    }).compile();

    service = module.get<InvoiceOcrService>(InvoiceOcrService);
  });

  it('debe extraer exitosamente los datos estructurados de una factura y calcular su SHA-256', async () => {
    const sampleBase64 = Buffer.from('PDF_DUMMY_VETERINARY_INVOICE_CONTENT').toString('base64');

    const result = await service.processInvoiceDocument(sampleBase64, 'application/pdf');

    expect(result).toBeDefined();
    expect(result.fileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.invoiceData.providerNit).toBe('901234567-8');
    expect(result.invoiceData.providerName).toContain('Hospital Veterinario de Antioquia');
    expect(result.invoiceData.invoiceNumber).toBe('FE-2026-1042');
    expect(result.invoiceData.dianCufe).toContain('cufe_canonical');
    expect(result.invoiceData.ocrConfidence).toBeGreaterThanOrEqual(0.85);

    // Verificación de dinero entero (ColombianPeso / bigint)
    expect(typeof result.invoiceData.totalInvoiceCop).toBe('bigint');
    expect(copToNumber(result.invoiceData.totalInvoiceCop)).toBe(150000);
    expect(result.invoiceData.items).toHaveLength(1);
    expect(copToNumber(result.invoiceData.items[0].amountCop)).toBe(150000);
  });

  it('debe detectar facturas de alto valor y extraer ítems quirúrgicos', async () => {
    const highAmountBase64 = Buffer.from('INVOICE_HIGH_AMOUNT_EXPENSIVE_SURGERY').toString('base64');

    const result = await service.processInvoiceDocument(highAmountBase64, 'application/pdf');

    expect(copToNumber(result.invoiceData.totalInvoiceCop)).toBe(450000);
    expect(result.invoiceData.items[0].category).toBe('SURGERY');
    expect(result.invoiceData.ocrConfidence).toBe(0.98);
  });

  it('debe reflejar baja confianza de OCR en documentos borrosos o ilegibles', async () => {
    const blurryBase64 = Buffer.from('BLURRY_INVOICE_LOW_CONFIDENCE').toString('base64');

    const result = await service.processInvoiceDocument(blurryBase64, 'image/jpeg');

    expect(result.invoiceData.ocrConfidence).toBe(0.65);
    expect(result.invoiceData.ocrConfidence).toBeLessThan(0.85);
  });
});
