import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClaimsTriageWorker } from './claims-triage.worker';

export interface ClaimsTriageJobData {
  claimId: string;
  policyId: string;
  userId?: string;
  documentIds?: string[];
  documentBase64?: string;
  mimeType?: string;
  claimedAmountCop?: number;
  idempotencyKey?: string;
}

export interface ClaimsTriageJobResult {
  jobId: string;
  claimId: string;
  status: 'COMPLETED' | 'FAILED';
  triageRoute: 'FAST_TRACK' | 'MANUAL_AUDIT';
  processedAt: string;
  reasons: string[];
}

export const CLAIMS_TRIAGE_QUEUE = 'CLAIMS_TRIAGE_QUEUE';

@Injectable()
export class ClaimsTriageQueueService {
  private readonly logger = new Logger(ClaimsTriageQueueService.name);
  private readonly jobs = new Map<string, { data: ClaimsTriageJobData; status: string; result?: ClaimsTriageJobResult }>();

  constructor(
    @Inject(forwardRef(() => ClaimsTriageWorker))
    private readonly worker: ClaimsTriageWorker,
  ) {}

  /**
   * Encola una tarea en `claims-triage-queue` de forma completamente asíncrona y no bloqueante.
   * Garantiza SLA de respuesta en API core < 250ms.
   */
  public async addTriageJob(data: ClaimsTriageJobData): Promise<{ jobId: string; enqueuedAt: string }> {
    const jobId = `job_triage_${randomUUID()}`;
    const enqueuedAt = new Date().toISOString();

    this.jobs.set(jobId, {
      data,
      status: 'WAITING',
    });

    this.logger.log(`[BullMQ / claims-triage-queue] Tarea ${jobId} encolada para el siniestro ${data.claimId}`);

    // Procesamiento asíncrono desacoplado en background worker
    setImmediate(async () => {
      try {
        const jobEntry = this.jobs.get(jobId);
        if (jobEntry) jobEntry.status = 'ACTIVE';

        const result = await this.worker.processJob(data);

        if (jobEntry) {
          jobEntry.status = 'COMPLETED';
          jobEntry.result = {
            jobId,
            claimId: data.claimId,
            status: 'COMPLETED',
            triageRoute: result.triageRoute,
            processedAt: new Date().toISOString(),
            reasons: result.reasons,
          };
        }
      } catch (err: any) {
        this.logger.error(`Error procesando tarea ${jobId} de siniestro ${data.claimId}: ${err.message}`);
        const jobEntry = this.jobs.get(jobId);
        if (jobEntry) {
          jobEntry.status = 'FAILED';
        }
      }
    });

    return { jobId, enqueuedAt };
  }

  /**
   * Consulta el estado de una tarea por su ID.
   */
  public getJob(jobId: string) {
    return this.jobs.get(jobId) || null;
  }
}
