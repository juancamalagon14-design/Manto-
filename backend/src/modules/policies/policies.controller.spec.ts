import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CancelPolicyDto } from './dto/cancel-policy.dto';
import { CheckoutPolicyDto } from './dto/checkout-policy.dto';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

describe('PoliciesController', () => {
  let controller: PoliciesController;
  let serviceMock: {
    initiateCheckout: jest.Mock;
    getPolicyById: jest.Mock;
    getDigitalCertificate: jest.Mock;
    cancelPolicy: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      initiateCheckout: jest.fn(),
      getPolicyById: jest.fn(),
      getDigitalCertificate: jest.fn(),
      cancelPolicy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoliciesController],
      providers: [
        {
          provide: PoliciesService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<PoliciesController>(PoliciesController);
  });

  it('debe estar definido e instanciado', () => {
    expect(controller).toBeDefined();
  });

  describe('Validación de DTOs', () => {
    it('debe validar errores cuando el quoteId no es un UUID v4', async () => {
      const dto = plainToInstance(CheckoutPolicyDto, {
        quoteId: 'invalid-not-uuid',
        customer: { fullName: 'Juan Perez', email: 'juan@example.com' },
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'quoteId')).toBe(true);
    });

    it('debe validar errores cuando faltan datos obligatorios del tomador', async () => {
      const dto = plainToInstance(CheckoutPolicyDto, {
        quoteId: '123e4567-e89b-12d3-a456-426614174000',
        customer: { email: 'bad-email-no-name' },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('debe validar que el motivo de cancelación tenga al menos 5 caracteres', async () => {
      const dto = plainToInstance(CancelPolicyDto, {
        reason: 'no', // Menor a 5 caracteres
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });
  });

  describe('Endpoints', () => {
    it('POST /v1/policies/checkout debe retornar 201 Created con la preferencia', async () => {
      const dto = plainToInstance(CheckoutPolicyDto, {
        quoteId: '123e4567-e89b-12d3-a456-426614174000',
        customer: { fullName: 'Mariana', email: 'mariana@example.com' },
      });

      const mockResponse = {
        policy: { id: 'pol-101', status: 'PENDING_PAYMENT' } as any,
        preferenceId: 'pref_mock_123',
        initPoint: 'https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=pref_mock_123',
        sandboxInitPoint: 'https://sandbox.mercadopago.com.co/...',
      };

      serviceMock.initiateCheckout.mockResolvedValue(mockResponse);

      const result = await controller.checkoutPolicy(dto);

      expect(result).toEqual(mockResponse);
      expect(serviceMock.initiateCheckout).toHaveBeenCalledWith(dto);
    });

    it('GET /v1/policies/:id debe retornar 200 OK con la póliza', async () => {
      const mockPolicy = { id: 'pol-101', status: 'ACTIVE' } as any;
      serviceMock.getPolicyById.mockResolvedValue(mockPolicy);

      const result = await controller.getPolicy('pol-101');

      expect(result).toEqual(mockPolicy);
      expect(serviceMock.getPolicyById).toHaveBeenCalledWith('pol-101');
    });

    it('GET /v1/policies/:id/certificate debe retornar 200 OK con la carátula digital', async () => {
      const mockCert = {
        policyNumber: 'MTO-PET-2026-ABC123',
        certificateHash: 'hash123',
      } as any;
      serviceMock.getDigitalCertificate.mockResolvedValue(mockCert);

      const result = await controller.getDigitalCertificate('pol-101');

      expect(result).toEqual(mockCert);
      expect(serviceMock.getDigitalCertificate).toHaveBeenCalledWith('pol-101');
    });

    it('POST /v1/policies/:id/cancel debe retornar 200 OK con la póliza cancelada', async () => {
      const dto = plainToInstance(CancelPolicyDto, { reason: 'Solicitud del titular' });
      const mockCancelled = { id: 'pol-101', status: 'CANCELLED' } as any;
      serviceMock.cancelPolicy.mockResolvedValue(mockCancelled);

      const result = await controller.cancelPolicy('pol-101', dto);

      expect(result).toEqual(mockCancelled);
      expect(serviceMock.cancelPolicy).toHaveBeenCalledWith('pol-101', dto);
    });
  });
});
