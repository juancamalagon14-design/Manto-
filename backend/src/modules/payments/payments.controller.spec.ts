import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let serviceMock: {
    processWebhookNotification: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      processWebhookNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('debe estar definido e instanciado', () => {
    expect(controller).toBeDefined();
  });

  it('POST /v1/payments/webhooks/mercadopago debe procesar la notificación y retornar 200 OK', async () => {
    const payload = { action: 'payment.updated', data: { id: '12345' } };
    const signature = 'ts=1726234567,v1=hash123';
    const requestId = 'req-xyz-789';

    serviceMock.processWebhookNotification.mockResolvedValue({
      received: true,
      status: 'APPROVED',
      policyId: 'pol-123',
    });

    const result = await controller.handleMercadoPagoWebhook(
      signature,
      requestId,
      payload,
      {},
    );

    expect(result).toEqual({
      received: true,
      status: 'APPROVED',
      policyId: 'pol-123',
    });
    expect(serviceMock.processWebhookNotification).toHaveBeenCalledWith(payload, {
      signature,
      requestId,
      query: {},
    });
  });
});
