import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BreBKeyType } from '../../reimbursements/reimbursements.types';
import { IncidentType } from '../claims.types';

export class BreBKeyDto {
  @IsIn(['PHONE_NUMBER', 'NATIONAL_ID', 'EMAIL', 'ALPHANUMERIC'], {
    message: 'El tipo de llave Bre-B debe ser PHONE_NUMBER, NATIONAL_ID, EMAIL o ALPHANUMERIC.',
  })
  public type!: BreBKeyType;

  @IsString()
  @IsNotEmpty({ message: 'El valor de la llave Bre-B no puede estar vacío.' })
  public value!: string;
}

export class DianInvoiceItemDto {
  @IsString()
  @IsNotEmpty({ message: 'La descripción del ítem es obligatoria.' })
  public description!: string;

  /**
   * `@IsInt`, no `@IsNumber`.
   *
   * Sin esto `400000.50` era entrada válida: se escribía con decimales en el
   * `jsonb` de la factura mientras la columna guardaba el redondeo. El peso
   * colombiano no tiene subdivisión en circulación; un monto con decimales es
   * un error de captura, y el sitio para rechazarlo es la frontera.
   */
  @IsInt({ message: 'El valor del ítem debe ser un entero en pesos, sin decimales.' })
  @Min(0)
  public amountCop!: number;

  @IsBoolean()
  public isCovered!: boolean;

  @IsString()
  @IsNotEmpty({ message: 'La categoría clínica del ítem es requerida.' })
  public category!: string;
}

export class DianInvoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'El número de factura electrónica es obligatorio.' })
  public invoiceNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'El NIT del prestador de servicios veterinarios es obligatorio.' })
  public providerNit!: string;

  @IsString()
  @IsNotEmpty({ message: 'La razón social del prestador es obligatoria.' })
  public providerName!: string;

  @IsString()
  @MinLength(8, { message: 'El CUFE de la DIAN debe contener al menos 8 caracteres.' })
  public dianCufe!: string;

  @IsISO8601({}, { message: 'La fecha de emisión debe estar en formato ISO 8601.' })
  public issueDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DianInvoiceItemDto)
  public items!: DianInvoiceItemDto[];

  @IsInt({ message: 'El total de la factura debe ser un entero en pesos, sin decimales.' })
  @Min(1, { message: 'El total de la factura debe ser mayor a 0 COP.' })
  public totalInvoiceCop!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  public ocrConfidence!: number;
}

export class ClinicalRecordDto {
  @IsString()
  @IsNotEmpty({ message: 'El diagnóstico presuntivo o motivo de consulta es obligatorio.' })
  public presumptiveDiagnosis!: string;

  @IsISO8601({}, { message: 'La fecha de inicio de síntomas debe ser una fecha válida ISO 8601.' })
  public symptomsOnsetDate!: string;

  @IsOptional()
  @IsString()
  public microchipNumber?: string;

  @IsOptional()
  @IsString()
  public veterinarianName?: string;

  @IsOptional()
  @IsString()
  public veterinarianLicense?: string;

  @IsOptional()
  @IsBoolean()
  public hasPreExistingSigns?: boolean;

  @IsOptional()
  @IsString()
  public preExistingNotes?: string;

  @IsOptional()
  @IsString()
  public clinicalSummary?: string;

  @IsOptional()
  @IsNumber()
  public ocrConfidence?: number;

  // Alias canónicos para retrocompatibilidad defensiva
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de inicio de síntomas (alias) debe ser ISO 8601.' })
  public symptomsStartDate?: string;

  @IsOptional()
  @IsString()
  public confirmedDiagnosis?: string;

  @IsOptional()
  @IsString()
  public attendingVetName?: string;

  @IsOptional()
  @IsString()
  public extractedMicrochip?: string;
}

export class SubmitClaimDto {
  @IsString()
  @IsNotEmpty({ message: 'El identificador de la póliza (policyId) es obligatorio.' })
  public policyId!: string;

  @IsIn(['ACCIDENT', 'COMMON_ILLNESS', 'EMERGENCY_CONSULTATION', 'CIVIL_LIABILITY', 'CIVIL_LIABILITY_1801', 'PREVENTIVE_WELLNESS'], {
    message: 'Tipo de incidente inválido.',
  })
  public incidentType!: IncidentType;

  @IsISO8601({}, { message: 'La fecha del incidente debe estar en formato ISO 8601.' })
  public incidentDate!: string;

  @IsString()
  @MinLength(5, { message: 'La descripción clínica del incidente debe contener al menos 5 caracteres.' })
  public description!: string;

  @IsDefined({ message: 'La factura DIAN es obligatoria.' })
  @IsNotEmptyObject({}, { message: 'La factura DIAN no puede estar vacía.' })
  @ValidateNested()
  @Type(() => DianInvoiceDto)
  public dianInvoice!: DianInvoiceDto;

  @IsDefined({ message: 'La Historia Clínica o Epicrisis es obligatoria para cualquier trámite.' })
  @IsNotEmptyObject({}, { message: 'La Historia Clínica no puede estar vacía.' })
  @ValidateNested()
  @Type(() => ClinicalRecordDto)
  public clinicalRecord!: ClinicalRecordDto;

  @IsDefined({ message: 'La llave Bre-B es obligatoria.' })
  @IsNotEmptyObject({}, { message: 'La llave Bre-B no puede estar vacía.' })
  @ValidateNested()
  @Type(() => BreBKeyDto)
  public breBKey!: BreBKeyDto;

  @IsInt({ message: 'Los gastos elegibles deben ser un entero en pesos, sin decimales.' })
  @Min(1, { message: 'Los gastos elegibles declarados deben ser mayores a 0 COP.' })
  public eligibleExpensesCop!: number;

  @IsOptional()
  @IsArray({ message: 'documentIds debe ser un arreglo de cadenas UUID' })
  public documentIds?: string[];

  @IsOptional()
  @IsInt({ message: 'El valor reclamado debe ser un entero en pesos' })
  @Min(10000, { message: 'El valor reclamado mínimo es de $10.000 COP' })
  @Max(100000000, { message: 'El valor reclamado excede el límite máximo asegurable de $100.000.000 COP' })
  public claimedAmountCop?: number;

  @IsOptional()
  @IsString()
  public vetClinicNit?: string;

  @IsOptional()
  @IsString()
  public vetClinicName?: string;

  @IsOptional()
  @IsIn(['NEQUI', 'DAVIPLATA', 'BRE_B', 'BANK_TRANSFER_ACH'])
  public payoutChannel?: 'NEQUI' | 'DAVIPLATA' | 'BRE_B' | 'BANK_TRANSFER_ACH';

  @IsOptional()
  @IsString()
  public payoutAccountIdentifier?: string;

  @IsOptional()
  @IsString()
  public accountHolderNationalId?: string;

  @IsOptional()
  @IsString()
  public bankCode?: string;

  @IsOptional()
  @IsIn(['SAVINGS', 'CHECKING', 'WALLET', 'BRE_B_KEY'])
  public accountType?: 'SAVINGS' | 'CHECKING' | 'WALLET' | 'BRE_B_KEY';
}

export class SubmitClaimResponseDto {
  claimId!: string;
  claimNumber!: string;
  status!: string;
  estimatedDecisionHours!: number;
  timelineInitialStep!: {
    status: string;
    label: string;
    timestamp: string;
    isCompleted: boolean;
  };
}
