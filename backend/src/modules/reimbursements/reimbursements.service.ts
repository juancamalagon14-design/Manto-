import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ColombianPeso, formatCop } from '../../common/types/money';
import {
  BRE_B_ADAPTER,
  BreBKey,
  BreBKeyResolution,
  DisbursementTransaction,
  IBreBAdapter,
  IReimbursementsRepository,
  REIMBURSEMENTS_REPOSITORY,
} from './reimbursements.types';

@Injectable()
export class ReimbursementsService {
  private readonly logger = new Logger(ReimbursementsService.name);

  private readonly disbursementLocks = new Map<string, Promise<DisbursementTransaction>>();

  constructor(
    @Inject(BRE_B_ADAPTER)
    private readonly breBAdapter: IBreBAdapter,
    @Inject(REIMBURSEMENTS_REPOSITORY)
    private readonly reimbursementsRepository: IReimbursementsRepository,
  ) {}

  /**
   * Ejecuta la dispersión inmediata de un siniestro aprobado a través de Bre-B
   * (Sistema de Pagos Inmediatos del Banco de la República).
   * Implementa idempotencia estricta y protección contra condiciones de carrera
   * para bloquear doble dispersión financiera.
   */
  public async disburseClaimViaBreB(
    claimId: string,
    policyId: string,
    amountCop: ColombianPeso,
    key: BreBKey,
  ): Promise<DisbursementTransaction> {
    if (!amountCop || amountCop <= 0n) {
      throw new BadRequestException('El monto a indemnizar vía Bre-B debe ser estrictamente positivo.');
    }

    // Mitigación de Race Conditions (Promise lock por claimId)
    if (this.disbursementLocks.has(claimId)) {
      return await this.disbursementLocks.get(claimId)!;
    }

    const disbursementPromise = this.performDisbursement(claimId, policyId, amountCop, key);
    this.disbursementLocks.set(claimId, disbursementPromise);

    try {
      return await disbursementPromise;
    } finally {
      this.disbursementLocks.delete(claimId);
    }
  }

  private async performDisbursement(
    claimId: string,
    policyId: string,
    amountCop: ColombianPeso,
    key: BreBKey,
  ): Promise<DisbursementTransaction> {
    // 1. Idempotencia: Verificar si ya existe una dispersión previa para este siniestro
    const existing = await this.reimbursementsRepository.findByClaimId(claimId);
    if (existing && (existing.status === 'SETTLED_INSTANTLY' || existing.status === 'PENDING')) {
      if (existing.amountCop !== amountCop) {
        throw new BadRequestException(
          `Conflicto de dispersión: El siniestro ${claimId} ya fue liquidado con un monto distinto (${formatCop(existing.amountCop)} vs ${formatCop(amountCop)}).`,
        );
      }
      this.logger.warn(
        `[Idempotencia Bre-B] Intento de doble dispersión interceptado para siniestro ${claimId}. Retornando transacción previa: ${existing.breBTrackingCode}`,
      );
      return existing;
    }

    // 2. Validación de sintaxis de la llave Bre-B colombiana
    const syntaxValidation = this.breBAdapter.validateKeySyntax(key);
    if (!syntaxValidation.valid) {
      this.logger.warn(`Llave Bre-B inválida para siniestro ${claimId}: ${syntaxValidation.error}`);
      throw new BadRequestException(syntaxValidation.error);
    }

    // 3. Resolución de entidad financiera destino
    const resolution = await this.breBAdapter.resolveKey(key);
    if (!resolution.valid) {
      throw new BadRequestException(`No se pudo resolver la llave Bre-B: ${resolution.reason}`);
    }

    // 4. Ejecutar dispersión mediante adaptador SPI (Banco de la República o Mock)
    const disbursementResult = await this.breBAdapter.disburse({
      claimId,
      policyId,
      amountCop,
      key,
    });

    // 5. Crear entidad transaccional inmutable en estado SETTLED_INSTANTLY
    const transaction: DisbursementTransaction = {
      id: uuidv4(),
      claimId,
      policyId,
      amountCop,
      key,
      financialInstitution: disbursementResult.financialInstitution,
      breBTrackingCode: disbursementResult.trackingCode,
      disbursedAt: disbursementResult.settledAt,
      status: 'SETTLED_INSTANTLY',
      createdAt: new Date().toISOString(),
    };

    // 6. Persistir en el repositorio
    const saved = await this.reimbursementsRepository.save(transaction);
    this.logger.log(
      `Dispersión Bre-B completada para siniestro ${claimId}. Monto: ${formatCop(amountCop)}. Institución: ${saved.financialInstitution}. Rastreo: ${saved.breBTrackingCode}`,
    );

    return saved;
  }

  /**
   * Obtiene la transacción de dispersión asociada a un siniestro.
   */
  public async getDisbursementByClaimId(claimId: string): Promise<DisbursementTransaction | null> {
    return await this.reimbursementsRepository.findByClaimId(claimId);
  }

  /**
   * Obtiene la transacción de dispersión por su identificador único UUID.
   */
  public async getDisbursementById(id: string): Promise<DisbursementTransaction> {
    const tx = await this.reimbursementsRepository.findById(id);
    if (!tx) {
      throw new NotFoundException(`Transacción de dispersión con ID ${id} no encontrada.`);
    }
    return tx;
  }

  /**
   * Valida sintácticamente una llave Bre-B.
   */
  public validateKey(key: BreBKey): { valid: boolean; error?: string } {
    return this.breBAdapter.validateKeySyntax(key);
  }

  /**
   * Resuelve el titular y entidad de una llave Bre-B registrada en Colombia.
   */
  public async resolveKey(key: BreBKey): Promise<BreBKeyResolution> {
    return await this.breBAdapter.resolveKey(key);
  }
}
