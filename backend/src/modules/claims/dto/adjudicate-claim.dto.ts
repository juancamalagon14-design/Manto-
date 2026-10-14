import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdjudicateClaimDto {
  @IsIn(['APPROVED', 'REJECTED'], {
    message: 'La decisión debe ser APPROVED o REJECTED.',
  })
  public decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsInt({ message: 'El monto aprobado ajustado debe ser un entero en pesos, sin decimales.' })
  @Min(1, { message: 'El monto aprobado ajustado debe ser mayor a 0 COP.' })
  public approvedAmountCop?: number;

  @IsOptional()
  @IsString()
  public adjusterNotes?: string;

  @IsOptional()
  @IsString()
  public adjusterId?: string;

  @IsOptional()
  @IsString()
  public rejectionReason?: string;
}
