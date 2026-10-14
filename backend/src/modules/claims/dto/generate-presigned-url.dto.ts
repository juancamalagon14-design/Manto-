import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  IsUUID,
} from 'class-validator';

export enum ClaimDocumentTypeDto {
  DIAN_INVOICE = 'DIAN_INVOICE',
  MEDICAL_HISTORY_EPICRISIS = 'MEDICAL_HISTORY_EPICRISIS',
  LAB_RESULTS = 'LAB_RESULTS',
  PRESCRIPTION = 'PRESCRIPTION',
  INCIDENT_PHOTO = 'INCIDENT_PHOTO',
  INCIDENT_PHOTOGRAPH = 'INCIDENT_PHOTOGRAPH',
  DAMAGE_EVIDENCE = 'DAMAGE_EVIDENCE',
  OTHER = 'OTHER',
}

export class GeneratePresignedUrlDto {
  @IsOptional()
  @IsUUID('all', { message: 'claimId debe ser un UUID válido si se provee' })
  claimId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'userId debe ser un UUID válido si se provee' })
  userId?: string;

  @IsNotEmpty({ message: 'El nombre del archivo es obligatorio' })
  @IsString()
  @Length(3, 255)
  @Matches(/^[a-zA-Z0-9_\-\. ]+\.(jpg|jpeg|png|pdf)$/i, {
    message: 'Nombre de archivo inválido o caracteres peligrosos. Solo se admiten JPG, PNG y PDF.',
  })
  fileName!: string;

  @IsNotEmpty({ message: 'El MIME type es obligatorio' })
  @IsString()
  @Matches(/^(image\/(jpeg|png)|application\/pdf)$/, {
    message: 'MIME type no permitido. Solo se acepta image/jpeg, image/png o application/pdf.',
  })
  mimeType!: string;

  @IsNotEmpty({ message: 'El tamaño del archivo es obligatorio' })
  @IsInt({ message: 'El tamaño del archivo debe ser un número entero de bytes' })
  @Min(1024, { message: 'El archivo debe pesar al menos 1KB' })
  @Max(26214400, { message: 'El archivo excede el límite máximo de 25MB' })
  fileSizeBytes!: number;

  @IsNotEmpty({ message: 'El tipo de documento es obligatorio' })
  @IsEnum(ClaimDocumentTypeDto, {
    message: 'Tipo de documento no válido. Opciones: DIAN_INVOICE, MEDICAL_HISTORY_EPICRISIS, LAB_RESULTS, PRESCRIPTION, INCIDENT_PHOTO.',
  })
  documentType!: ClaimDocumentTypeDto;

  @IsNotEmpty({ message: 'El checksum SHA-256 es obligatorio para integridad' })
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'El checksum SHA-256 debe tener exactamente 64 caracteres hexadecimales',
  })
  sha256Checksum!: string;
}

export class PresignedUrlResponseDto {
  documentId!: string; // UUIDv7 registrado previamente en estado 'PENDING'
  uploadUrl!: string; // URL prefirmada PUT de S3 / Cloudflare R2
  s3Key!: string;
  expiresInSeconds!: number; // 900 (15 minutos)
  requiredHeaders!: Record<string, string>; // { 'Content-Type': '...', 'x-amz-checksum-sha256': '...' }
}
