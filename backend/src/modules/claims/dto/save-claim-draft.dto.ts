import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * DTO para la persistencia de borradores de reclamos (Claims Draft).
 * Permite guardar el estado parcial de un reclamo en progreso con TTL de 24 horas.
 */
export class SaveClaimDraftDto {
  /**
   * Identificador del usuario o sesión del cliente.
   * Si no se especifica, se utiliza policyId como identificador de sesión.
   */
  @IsOptional()
  @IsString({ message: 'userId debe ser una cadena de texto' })
  userId?: string;

  /** Identificador obligatorio de la póliza asociada. */
  @IsString({ message: 'policyId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El policyId es obligatorio para guardar el borrador' })
  policyId!: string;

  /** Hito o paso actual en el flujo de radicación (1 a 5). */
  @IsInt({ message: 'currentStep debe ser un número entero' })
  @Min(1, { message: 'El paso mínimo es 1' })
  @Max(5, { message: 'El paso máximo es 5' })
  currentStep!: number;

  /**
   * Estado parcial del formulario de radicación:
   * tipo de incidente, fecha, descripción, soportes preliminares subidos,
   * datos bancarios/Bre-B, etc.
   */
  @IsDefined({ message: 'formData es obligatorio' })
  formData!: Record<string, unknown>;

  /** Timestamp en milisegundos de la captura en el cliente. */
  @IsOptional()
  @IsNumber({}, { message: 'savedAtTimestamp debe ser un número en milisegundos' })
  savedAtTimestamp?: number;
}
