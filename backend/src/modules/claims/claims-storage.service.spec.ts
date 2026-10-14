import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClaimsStorageService } from './claims-storage.service';
import { ClaimDocumentTypeDto, GeneratePresignedUrlDto } from './dto/generate-presigned-url.dto';

describe('ClaimsStorageService (Presigned URLs & Bóveda de Documentos S3/R2)', () => {
  let service: ClaimsStorageService;

  const validSha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const validDto: GeneratePresignedUrlDto = {
    fileName: 'factura_veterinaria_001.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 204800, // 200 KB
    documentType: ClaimDocumentTypeDto.DIAN_INVOICE,
    sha256Checksum: validSha256,
  };

  beforeEach(() => {
    service = new ClaimsStorageService();
  });

  describe('generatePresignedUploadUrl', () => {
    it('debe generar una URL prefirmada válida con expiración de 15 minutos (900s) y headers requeridos', async () => {
      const response = await service.generatePresignedUploadUrl(validDto, 'user-uuid-001');

      expect(response).toBeDefined();
      expect(response.documentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(response.expiresInSeconds).toBe(900);
      expect(response.uploadUrl).toContain('X-Amz-Expires=900');
      expect(response.uploadUrl).toContain('X-Amz-Signature=');
      expect(response.s3Key).toMatch(/^claims\/documents\/\d{4}\/\d{2}\//);
      expect(response.requiredHeaders['Content-Type']).toBe('application/pdf');
      expect(response.requiredHeaders['x-amz-checksum-sha256']).toBe(validSha256);

      const savedDoc = await service.getDocumentById(response.documentId);
      expect(savedDoc).toBeDefined();
      expect(savedDoc?.uploadStatus).toBe('PENDING');
      expect(savedDoc?.userId).toBe('user-uuid-001');
    });

    it('debe rechazar extensiones peligrosas (.exe, .sh, .bat, .php)', async () => {
      const maliciousDto: GeneratePresignedUrlDto = {
        ...validDto,
        fileName: 'malware.exe',
      };

      await expect(service.generatePresignedUploadUrl(maliciousDto, 'user-001')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.generatePresignedUploadUrl(maliciousDto, 'user-001')).rejects.toThrow(
        /Extensión de archivo no permitida/,
      );
    });

    it('debe rechazar MIME types no permitidos (ej. text/html, application/javascript)', async () => {
      const illegalMimeDto: GeneratePresignedUrlDto = {
        ...validDto,
        mimeType: 'text/html',
      };

      await expect(service.generatePresignedUploadUrl(illegalMimeDto, 'user-001')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.generatePresignedUploadUrl(illegalMimeDto, 'user-001')).rejects.toThrow(
        /MIME type no admitido/,
      );
    });

    it('debe rechazar archivos menores a 1KB (1024 bytes)', async () => {
      const smallDto: GeneratePresignedUrlDto = {
        ...validDto,
        fileSizeBytes: 500,
      };

      await expect(service.generatePresignedUploadUrl(smallDto, 'user-001')).rejects.toThrow(
        /El archivo debe pesar al menos 1KB/,
      );
    });

    it('debe rechazar archivos mayores a 25MB (26.214.400 bytes)', async () => {
      const giantDto: GeneratePresignedUrlDto = {
        ...validDto,
        fileSizeBytes: 30_000_000,
      };

      await expect(service.generatePresignedUploadUrl(giantDto, 'user-001')).rejects.toThrow(
        /El archivo excede el tamaño máximo permitido de 25MB/,
      );
    });

    it('debe rechazar checksums SHA-256 no válidos (distintos de 64 caracteres hex)', async () => {
      const invalidHashDto: GeneratePresignedUrlDto = {
        ...validDto,
        sha256Checksum: 'invalid_short_hash',
      };

      await expect(service.generatePresignedUploadUrl(invalidHashDto, 'user-001')).rejects.toThrow(
        /El checksum SHA-256 debe contener exactamente 64 caracteres hexadecimales/,
      );
    });
  });

  describe('confirmDocumentUpload y BOLA/IDOR Protection', () => {
    it('debe confirmar exitosamente la carga si el usuario es el propietario', async () => {
      const presigned = await service.generatePresignedUploadUrl(validDto, 'owner-user-001');
      const confirmed = await service.confirmDocumentUpload(presigned.documentId, 'owner-user-001');

      expect(confirmed.uploadStatus).toBe('UPLOADED');
    });

    it('debe arrojar ForbiddenException si otro usuario intenta confirmar o asociar el documento ajeno (BOLA/IDOR)', async () => {
      const presigned = await service.generatePresignedUploadUrl(validDto, 'victim-user-001');

      await expect(
        service.confirmDocumentUpload(presigned.documentId, 'attacker-user-999'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.validateUserDocuments([presigned.documentId], 'attacker-user-999'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe arrojar NotFoundException si se intenta confirmar un documentId inexistente', async () => {
      await expect(
        service.confirmDocumentUpload('00000000-0000-0000-0000-000000000000', 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('linkDocumentsToClaim', () => {
    it('debe asociar correctamente los documentos al claimId', async () => {
      const presigned1 = await service.generatePresignedUploadUrl(validDto, 'user-001');
      const presigned2 = await service.generatePresignedUploadUrl(
        { ...validDto, fileName: 'radiografia.jpg', mimeType: 'image/jpeg' },
        'user-001',
      );

      const linked = await service.linkDocumentsToClaim(
        [presigned1.documentId, presigned2.documentId],
        'claim-uuid-999',
        'user-001',
      );

      expect(linked).toHaveLength(2);
      expect(linked[0].claimId).toBe('claim-uuid-999');
      expect(linked[1].claimId).toBe('claim-uuid-999');
    });
  });
});
