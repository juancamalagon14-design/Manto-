import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BindQuoteDto {
  /**
   * Método de pago seleccionado para la emisión y recurrencia (ej. 'WOMPI_TOKENIZED_CARD', 'PSE', 'NEQUI').
   */
  @IsString({ message: 'El tipo de método de pago debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El tipo de método de pago es obligatorio' })
  paymentMethodType: string;

  /**
   * Token de tarjeta de crédito/débito retornado por la pasarela de pagos (ej. Wompi tokenize).
   */
  @IsOptional()
  @IsString({ message: 'El token de tarjeta debe ser una cadena de texto' })
  cardToken?: string;

  /**
   * Frecuencia de cobro confirmada para la vinculación.
   */
  @IsOptional()
  @IsIn(['MONTHLY', 'ANNUAL'], {
    message: 'La frecuencia de facturación debe ser MONTHLY o ANNUAL',
  })
  billingFrequency?: 'MONTHLY' | 'ANNUAL';
}
