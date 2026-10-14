import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { toCop } from '../../common/types/money';
import { GeminiProvider } from '../ai/gemini.provider';
import { ClinicalRecordData, DianInvoiceData } from './claims.types';

@Injectable()
export class InvoiceOcrService {
  private readonly logger = new Logger(InvoiceOcrService.name);

  constructor(private readonly geminiProvider: GeminiProvider) {}

  /**
   * Extrae los metadatos estructurados de una factura electrónica médica/veterinaria
   * utilizando Gemini 3.6 Flash / Visión.
   * Transforma montos estrictamente a ColombianPeso entero.
   */
  public async processInvoiceDocument(
    documentBase64: string,
    mimeType = 'application/pdf',
  ): Promise<{
    invoiceData: DianInvoiceData;
    fileSha256: string;
  }> {
    // 1. Calcular hash SHA-256 inmutable del binario para control antifraude
    const cleanBase64 = documentBase64.replace(/^data:[a-zA-Z\/-]+;base64,/, '');
    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    const fileSha256 = createHash('sha256').update(fileBuffer).digest('hex');

    this.logger.log(`Procesando OCR con Gemini 3.6 Flash. Hash documento: ${fileSha256}`);

    // 2. Extraer datos con Gemini 3.6 Flash
    const extracted = await this.geminiProvider.extractInvoiceData(cleanBase64, mimeType);

    // 3. Mapear a DianInvoiceData con enteros nominales en ColombianPeso
    const invoiceData: DianInvoiceData = {
      invoiceNumber: extracted.invoiceNumber,
      providerNit: extracted.providerNit,
      providerName: extracted.providerName,
      dianCufe: extracted.dianCufe,
      issueDate: extracted.issueDate || new Date().toISOString(),
      items: (extracted.items || []).map((item) => ({
        description: item.description,
        amountCop: toCop(item.amountCop),
        isCovered: item.isCovered,
        category: item.category || 'CLINIC',
      })),
      totalInvoiceCop: toCop(extracted.totalInvoiceCop),
      ocrConfidence: extracted.ocrConfidence,
    };

    return {
      invoiceData,
      fileSha256,
    };
  }

  /**
   * Extrae los metadatos clínicos de la Historia Clínica / Epicrisis veterinaria
   * utilizando Gemini 3.6 Flash / Visión.
   * Requisito OBLIGATORIO para la detección de preexistencias y validación de carencias.
   */
  public async processClinicalRecordDocument(
    documentBase64: string,
    mimeType = 'application/pdf',
  ): Promise<{
    clinicalRecord: ClinicalRecordData;
    fileSha256: string;
  }> {
    const cleanBase64 = documentBase64.replace(/^data:[a-zA-Z\/-]+;base64,/, '');
    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    const fileSha256 = createHash('sha256').update(fileBuffer).digest('hex');

    this.logger.log(`Procesando Historia Clínica con Gemini. Hash documento: ${fileSha256}`);

    const extracted = await this.geminiProvider.extractClinicalRecordData(cleanBase64, mimeType);

    const clinicalRecord: ClinicalRecordData = {
      symptomsOnsetDate: extracted.symptomsOnsetDate || new Date().toISOString(),
      presumptiveDiagnosis: extracted.presumptiveDiagnosis || 'Atención de urgencia veterinaria',
      microchipNumber: extracted.microchipNumber,
      veterinarianName: extracted.veterinarianName,
      veterinarianLicense: extracted.veterinarianLicense,
      hasPreExistingSigns: extracted.hasPreExistingSigns || false,
      preExistingNotes: extracted.preExistingNotes,
      clinicalSummary: extracted.clinicalSummary,
      ocrConfidence: extracted.ocrConfidence,
    };

    return {
      clinicalRecord,
      fileSha256,
    };
  }
}
