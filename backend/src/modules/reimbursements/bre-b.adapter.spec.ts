import { toCop } from '../../common/types/money';
import {
  BreBAdapter,
  MockBreBAdapter,
  RealBreBAdapter,
  validateBreBKeySyntax,
} from './bre-b.adapter';
import { BreBKey } from './reimbursements.types';

describe('BreBAdapter & Syntax Validation (SPI Banco de la República)', () => {
  let mockAdapter: MockBreBAdapter;

  beforeEach(() => {
    mockAdapter = new MockBreBAdapter();
  });

  describe('validateBreBKeySyntax', () => {
    it('debe validar números celulares colombianos (10 dígitos iniciando en 3)', () => {
      expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '3001234567' }).valid).toBe(true);
      expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '3109876543' }).valid).toBe(true);
      expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '3205551234' }).valid).toBe(true);

      // Inválidos
      expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '2001234567' }).valid).toBe(false);
      expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '300123456' }).valid).toBe(false);
      expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '30012345678' }).valid).toBe(false);
      expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '300abc4567' }).valid).toBe(false);
    });

    it('debe validar identificaciones nacionales colombianas (6 a 10 dígitos numéricos)', () => {
      expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '1017123456' }).valid).toBe(true);
      expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '52123456' }).valid).toBe(true);
      expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '80123456' }).valid).toBe(true);

      // Inválidos
      expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '12345' }).valid).toBe(false);
      expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '12345678901' }).valid).toBe(false);
      expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '1017A23456' }).valid).toBe(false);
    });

    it('debe validar correos electrónicos compatibles con SPI', () => {
      expect(validateBreBKeySyntax({ type: 'EMAIL', value: 'usuario@manto.co' }).valid).toBe(true);
      expect(validateBreBKeySyntax({ type: 'EMAIL', value: 'pedro.ramirez@nequi.com.co' }).valid).toBe(true);

      // Inválidos
      expect(validateBreBKeySyntax({ type: 'EMAIL', value: 'not-an-email' }).valid).toBe(false);
      expect(validateBreBKeySyntax({ type: 'EMAIL', value: 'user@' }).valid).toBe(false);
      expect(validateBreBKeySyntax({ type: 'EMAIL', value: '@dominio.com' }).valid).toBe(false);
    });

    it('debe validar llaves alfanuméricas registradas (5 a 30 caracteres)', () => {
      expect(validateBreBKeySyntax({ type: 'ALPHANUMERIC', value: 'alias_manto_01' }).valid).toBe(true);
      expect(validateBreBKeySyntax({ type: 'ALPHANUMERIC', value: 'usuario-breb' }).valid).toBe(true);

      // Inválidos
      expect(validateBreBKeySyntax({ type: 'ALPHANUMERIC', value: 'ab' }).valid).toBe(false);
      expect(validateBreBKeySyntax({ type: 'ALPHANUMERIC', value: 'alias con espacios' }).valid).toBe(false);
      expect(validateBreBKeySyntax({ type: 'ALPHANUMERIC', value: 'alias!@#' }).valid).toBe(false);
    });

    it('debe rechazar llaves con tipos no soportados o datos corruptos', () => {
      expect(validateBreBKeySyntax({ type: 'BITCOIN_WALLET' as any, value: '1BoatSLRHtKNngkdRqe7VG50' }).valid).toBe(false);
      expect(validateBreBKeySyntax(null as any).valid).toBe(false);
    });
  });

  describe('MockBreBAdapter', () => {
    it('debe reportar que opera en modo mock', () => {
      expect(mockAdapter.isUsingMock()).toBe(true);
    });

    it('debe resolver entidades financieras correctamente según la llave', async () => {
      const resBancolombia = await mockAdapter.resolveKey({ type: 'PHONE_NUMBER', value: '3001234567' });
      expect(resBancolombia.valid).toBe(true);
      expect(resBancolombia.financialInstitution).toBe('Bancolombia');

      const resDavivienda = await mockAdapter.resolveKey({ type: 'PHONE_NUMBER', value: '3101234567' });
      expect(resDavivienda.financialInstitution).toBe('Davivienda');

      const resNequi = await mockAdapter.resolveKey({ type: 'PHONE_NUMBER', value: '3151234567' });
      expect(resNequi.financialInstitution).toBe('Nequi');

      const resDaviplata = await mockAdapter.resolveKey({ type: 'PHONE_NUMBER', value: '3201234567' });
      expect(resDaviplata.financialInstitution).toBe('Daviplata');

      const resEmailNequi = await mockAdapter.resolveKey({ type: 'EMAIL', value: 'pagos@nequi.com.co' });
      expect(resEmailNequi.financialInstitution).toBe('Nequi');
    });

    it('debe ejecutar dispersión instantánea generando código de rastreo BREB-2026-XXXX', async () => {
      const result = await mockAdapter.disburse({
        claimId: 'clm-test-001',
        policyId: 'pol-test-001',
        amountCop: toCop(250000),
        key: { type: 'PHONE_NUMBER', value: '3005557890' },
      });

      expect(result.trackingCode).toMatch(/^BREB-2026-[A-F0-9]{8}$/);
      expect(result.financialInstitution).toBe('Bancolombia');
      expect(result.settledAt).toBeDefined();
    });

    it('debe arrojar error si se intenta dispersar con una llave de sintaxis inválida', async () => {
      await expect(
        mockAdapter.disburse({
          claimId: 'clm-test-002',
          policyId: 'pol-test-002',
          amountCop: toCop(100000),
          key: { type: 'PHONE_NUMBER', value: '123' },
        }),
      ).rejects.toThrow('Error en llave Bre-B');
    });
  });

  describe('BreBAdapter (Dual Switcher)', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('debe conmutar automáticamente a MockBreBAdapter cuando no hay BRE_B_API_KEY', () => {
      delete process.env.BRE_B_API_KEY;
      const adapter = new BreBAdapter();
      expect(adapter.isUsingMock()).toBe(true);
    });

    it('debe activar RealBreBAdapter cuando existe BRE_B_API_KEY configurada', () => {
      process.env.BRE_B_API_KEY = 'prod_spi_banrep_secret_key_2026';
      const adapter = new BreBAdapter();
      expect(adapter.isUsingMock()).toBe(false);
    });
  });

  describe('RealBreBAdapter', () => {
    it('debe operar con API Key real y reportar isUsingMock = false', async () => {
      const real = new RealBreBAdapter('test_key');
      expect(real.isUsingMock()).toBe(false);

      const res = await real.disburse({
        claimId: 'clm-prod-001',
        policyId: 'pol-prod-001',
        amountCop: toCop(500000),
        key: { type: 'EMAIL', value: 'beneficiario@example.com' },
      });

      expect(res.trackingCode).toMatch(/^BREB-2026-[A-F0-9]{8}$/);
      expect(res.financialInstitution).toBe('Bancolombia');
    });
  });
});
