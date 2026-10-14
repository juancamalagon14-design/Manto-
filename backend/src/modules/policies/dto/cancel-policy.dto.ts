import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CancelPolicyDto {
  @IsString({ message: 'La causa de cancelación debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La causa de cancelación es obligatoria' })
  @MinLength(5, { message: 'La causa de cancelación debe contener al menos 5 caracteres' })
  reason: string;

  @IsOptional()
  @IsString({ message: 'El identificador de quien solicita la cancelación debe ser texto' })
  cancelledBy?: string;
}
