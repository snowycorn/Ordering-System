// src/integrations/vendor-menu.client.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VendorMenuClient } from './vendor-menu.client';

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe('VendorMenuClient', () => {
  let client: VendorMenuClient;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    fetchSpy = jest.spyOn(global, 'fetch');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorMenuClient,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              key === 'VENDOR_MENU_SERVICE_URL'
                ? 'http://vendor-menu:3007'
                : defaultValue,
          },
        },
      ],
    }).compile();

    client = module.get(VendorMenuClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createVendor()', () => {
    it('成功（2xx）時不拋出', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, {}));
      await expect(client.createVendor('Test Vendor', 'North')).resolves.toBeUndefined();
    });

    it('呼叫 POST /api/v1/admin/vendors 帶有 x-user-role: admin header', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, {}));
      await client.createVendor('Test Vendor', 'North');

      const call = fetchSpy.mock.calls[0];
      const url = call[0] as string;
      const options = call[1] as RequestInit;
      expect(url).toContain('/api/v1/admin/vendors');
      expect((options.headers as Record<string, string>)['x-user-role']).toBe('admin');
    });

    it('factoryZone 為 undefined 時不傳入 body', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, {}));
      await client.createVendor('Test Vendor', undefined);

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body).not.toHaveProperty('factoryZone');
    });

    it('HTTP 錯誤（非 2xx） → BadRequestException', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(500, 'Internal Server Error'));
      await expect(client.createVendor('Test Vendor', 'North')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('400 也拋 BadRequestException', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(400, 'Bad Request'));
      await expect(client.createVendor('X', null)).rejects.toThrow(BadRequestException);
    });
  });
});
