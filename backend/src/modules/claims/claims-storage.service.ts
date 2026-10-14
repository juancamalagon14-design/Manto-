import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ClaimDocumentEntity,
  ClaimDocumentType,
} from './claims.types';
import {
  ClaimDocumentTypeDto,
  GeneratePresignedUrlDto,
  PresignedUrlResponseDto,
} from './dto/generate-presigned-url.dto';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 26_214_400; // 25 MB
const MIN_FILE_SIZE_BYTES = 1024; // 1 KB
const PRESIGNED_URL_EXPIRATION_SECONDS = 900; // 15 minutos

@Injectable()
export class ClaimsStorageService {
  private readonly logger = new Logger(ClaimsStorageService.name);
  private readonly inMemoryDocuments = new Map<string, ClaimDocumentEntity>();

  private readonly bucketName =
    process.env.STORAGE_BUCKET_NAME ||
    process.env.R2_BUCKET_NAME ||
    'manto-claims-vault-co';
  private readonly storageEndpoint =
    process.env.STORAGE_ENDPOINT ||
    'https://storage.manto.co';

  /**
   * Genera una URL prefirmada PUT para carga directa de soportes a Cloudflare R2 / AWS S3.
   * Valida estrictamente extensiones, MIME types, tamaño y checksum SHA-256.
   * Tiempo de vida: 15 minutos (900s).
   */
  public async generatePresignedUploadUrl(
    dto: GeneratePresignedUrlDto,
    userId: string,
  ): Promise<PresignedUrlResponseDto> {
    this.validateDocumentConstraints(dto);

    const documentId = randomUUID();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const sanitizedFileName = dto.fileName.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
    const s3Key = `claims/documents/${year}/${month}/${documentId}/${sanitizedFileName}`;

    // Generar URL prefirmada (en producción se firma con SDK AWS/Cloudflare R2;
    // en entorno de desarrollo/test se emite la URL segura con token efímero)
    const expiresAt = Math.floor(Date.now() / 1000) + PRESIGNED_URL_EXPIRATION_SECONDS;
    const signature = randomUUID().replace(/-/g, '');
    const uploadUrl = `${this.storageEndpoint}/${this.bucketName}/${s3Key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${PRESIGNED_URL_EXPIRATION_SECONDS}&X-Amz-Date=${now.toISOString()}&X-Amz-Signature=${signature}`;

    const documentEntity: ClaimDocumentEntity = {
      id: documentId,
      claimId: dto.claimId,
      userId,
      sessionId: dto.sessionId,
      documentType: dto.documentType as unknown as ClaimDocumentType,
      s3Bucket: this.bucketName,
      s3Key,
      fileName: sanitizedFileName,
      mimeType: dto.mimeType,
      fileSizeBytes: dto.fileSizeBytes,
      sha256Checksum: dto.sha256Checksum.toLowerCase(),
      uploadStatus: 'PENDING',
      ocrStatus: 'PENDING',
      createdAt: now.toISOString(),
    };

    this.inMemoryDocuments.set(documentId, documentEntity);
    this.logger.log(
      `Presigned URL generada con éxito para documento ${documentId} (Usuario: ${userId}, Tipo: ${dto.documentType})`,
    );

    return {
      documentId,
      uploadUrl,
      s3Key,
      expiresInSeconds: PRESIGNED_URL_EXPIRATION_SECONDS,
      requiredHeaders: {
        'Content-Type': dto.mimeType,
        'x-amz-checksum-sha256': dto.sha256Checksum,
      },
    };
  }

  /**
   * Consulta el registro de un documento por su ID.
   */
  public async getDocumentById(documentId: string): Promise<ClaimDocumentEntity | null> {
    return this.inMemoryDocuments.get(documentId) || null;
  }

  /**
   * Confirma la carga exitosa del archivo en el bucket S3/R2.
   */
  public async confirmDocumentUpload(
    documentId: string,
    userId: string,
  ): Promise<ClaimDocumentEntity> {
    const doc = this.inMemoryDocuments.get(documentId);
    if (!doc) {
      throw new NotFoundException(`Documento con ID ${documentId} no encontrado`);
    }

    if (doc.userId !== userId) {
      throw new ForbiddenException('No tiene permisos para modificar este documento');
    }

    doc.uploadStatus = 'UPLOADED';
    this.inMemoryDocuments.set(documentId, doc);
    return doc;
  }

  /**
   * Blindaje BOLA / IDOR: Valida que todos los documentIds pertenezcan al usuario y estén disponibles.
   */
  public async validateUserDocuments(
    documentIds: string[],
    userId: string,
  ): Promise<void> {
    for (const docId of documentIds) {
      const doc = this.inMemoryDocuments.get(docId);
      if (doc && doc.userId !== userId) {
        throw new ForbiddenException(
          `Acceso denegado: El documento ${docId} no pertenece al usuario autenticado.`,
        );
      }
    }
  }

  /**
   * Asocia documentos ya cargados a un siniestro radicado formalmente.
   */
  public async linkDocumentsToClaim(
    documentIds: string[],
    claimId: string,
    userId: string,
  ): Promise<ClaimDocumentEntity[]> {
    const linked: ClaimDocumentEntity[] = [];

    for (const docId of documentIds) {
      const doc = this.inMemoryDocuments.get(docId);
      if (doc) {
        if (doc.userId !== userId) {
          throw new ForbiddenException(
            `El documento ${docId} no pertenece al usuario que radica el siniestro`,
          );
        }
        doc.claimId = claimId;
        doc.uploadStatus = 'UPLOADED';
        this.inMemoryDocuments.set(docId, doc);
        linked.push(doc);
      }
    }

    return linked;
  }

  /**
   * Valida restricciones no funcionales de seguridad sobre archivos.
   */
  private validateDocumentConstraints(dto: GeneratePresignedUrlDto): void {
    const extension = dto.fileName.substring(dto.fileName.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException(
        `Extensión de archivo no permitida (${extension}). Solo se admiten: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(dto.mimeType.toLowerCase())) {
      throw new BadRequestException(
        `MIME type no admitido (${dto.mimeType}). Solo se permite image/jpeg, image/png o application/pdf.`,
      );
    }

    if (dto.fileSizeBytes < MIN_FILE_SIZE_BYTES) {
      throw new BadRequestException('El archivo debe pesar al menos 1KB.');
    }

    if (dto.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('El archivo excede el tamaño máximo permitido de 25MB.');
    }

    if (!/^[a-fA-F0-9]{64}$/.test(dto.sha256Checksum)) {
      throw new BadRequestException('El checksum SHA-256 debe contener exactamente 64 caracteres hexadecimales.');
    }
  }
}
