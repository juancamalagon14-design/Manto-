import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PaymentMethodType } from '../../payments/payments.types';

export class PolicyCustomerDto {
  @IsString({ message: 'El nombre del cliente debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre completo del tomador es obligatorio' })
  fullName: string;

  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'El documento de identidad debe ser una cadena de texto' })
  nationalId?: string;
}

export class CheckoutPolicyDto {
  @IsUUID('4', { message: 'El quoteId debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El identificador de la cotización es obligatorio' })
  quoteId: string;

  @ValidateNested()
  @Type(() => PolicyCustomerDto)
  @IsNotEmptyObject({}, { message: 'Los datos del tomador son obligatorios' })
  customer: PolicyCustomerDto;

  @IsOptional()
  @IsIn(['CREDIT_CARD', 'DEBIT_CARD', 'PSE', 'CASH'], {
    message: 'Método de pago no válido (debe ser CREDIT_CARD, DEBIT_CARD, PSE o CASH)',
  })
  paymentMethodType?: PaymentMethodType;

  @IsOptional()
  @IsIn(['MONTHLY', 'ANNUAL'], {
    message: 'La frecuencia de facturación debe ser MONTHLY o ANNUAL',
  })
  billingFrequency?: 'MONTHLY' | 'ANNUAL';

  @IsOptional()
  @IsBoolean({ message: 'autoRenewalEnabled debe ser un valor booleano' })
  autoRenewalEnabled?: boolean;
}
