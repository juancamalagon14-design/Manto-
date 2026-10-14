import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AuditActorType,
  ClaimAuditLogEntity,
  ClaimStatus,
} from './claims.types';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly auditLogs: ClaimAuditLogEntity[] = [];

  /**
   * Registra un evento inmutable en la bitácora de auditoría del siniestro (Append-Only).
   */
  public async logEvent(params: {
    claimId: string;
    actorType: AuditActorType;
    actorId: string;
    action: string;
    previousStatus?: ClaimStatus;
    newStatus?: ClaimStatus;
    reason?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ClaimAuditLogEntity> {
    const logEntry: ClaimAuditLogEntity = {
      id: randomUUID(),
      claimId: params.claimId,
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      reason: params.reason,
      metadata: params.metadata || {},
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      createdAt: new Date().toISOString(),
    };

    this.auditLogs.push(logEntry);
    this.logger.log(
      `[AuditLog] Siniestro ${params.claimId} | Acción: ${params.action} | Actor: ${params.actorType} (${params.actorId})`,
    );

    return logEntry;
  }

  /**
   * Obtiene la cronología completa de auditoría para un siniestro.
   */
  public async getLogsByClaimId(claimId: string): Promise<ClaimAuditLogEntity[]> {
    return this.auditLogs
      .filter((log) => log.claimId === claimId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
}
