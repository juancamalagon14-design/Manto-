import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CalculateQuoteDto } from '../../pricing/dto/calculate-quote.dto';

/**
 * Entrada de emisión de cotización.
 *
 * Extiende `CalculateQuoteDto` en vez de repetir sus campos. Antes eran dos
 * archivos de ~310 líneas con la misma docena de campos declarados por
 * separado, y ya habían divergido: el mismo bypass de validación por campos
 * alias había que arreglarlo dos veces, y el mensaje de error de una ciudad
 * inválida no era el mismo en las dos rutas.
 *
 * `class-validator` hereda los decoradores de la clase base, así que tarifar y
 * emitir validan exactamente igual por construcción. Lo único que se declara
 * aquí es lo que emitir tiene y tarifar no: la mascota con nombre, el tomador
 * y la declaración de preexistencias.
 */
export class CreateQuoteDto extends CalculateQuoteDto {
  /** Nombre de la mascota a asegurar. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El nombre de la mascota debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la mascota es obligatorio' })
  petName: string;

  /** Datos de contacto del tomador. */
  @IsOptional()
  @IsEmail({}, { message: 'customerEmail debe ser un correo electrónico válido' })
  customerEmail?: string;

  @IsOptional()
  @IsString({ message: 'customerName debe ser una cadena de texto' })
  customerName?: string;

  @IsOptional()
  @IsString({ message: 'customerPhone debe ser una cadena de texto' })
  customerPhone?: string;

  /** Declaración de condiciones crónicas preexistentes, para elegibilidad. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'hasPreExistingChronicConditions debe ser booleano' })
  hasPreExistingChronicConditions?: boolean = false;
}
