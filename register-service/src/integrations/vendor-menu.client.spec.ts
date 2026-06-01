// src/integrations/vendor-menu.client.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
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
      await expect(client.createVendor('Test Vendor', ['A廠'], 42)).resolves.toBeUndefined();
    });

    it('呼叫 POST /api/v1/admin/vendors 帶有 x-user-role: admin header、userId 與 factoryZones 陣列', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, {}));
      await client.createVendor('Test Vendor', ['A廠', 'B廠'], 42);

      const call = fetchSpy.mock.calls[0];
      const url = call[0] as string;
      const options = call[1] as RequestInit;
      expect(url).toContain('/api/v1/admin/vendors');
      expect((options.headers as Record<string, string>)['x-user-role']).toBe('admin');
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.userId).toBe(42);
      expect(body.factoryZones).toEqual(['A廠', 'B廠']);
    });

    it('factoryZones 為 undefined / 空陣列時不傳入 body，但仍帶 userId', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, {}));
      await client.createVendor('Test Vendor', undefined, 42);
      let body = JSON.parse(fetchSpy.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body).not.toHaveProperty('factoryZones');
      expect(body.userId).toBe(42);

      fetchSpy.mockResolvedValueOnce(mockResponse(201, {}));
      await client.createVendor('Test Vendor', [], 42);
      body = JSON.parse(fetchSpy.mock.calls[1][1].body as string) as Record<string, unknown>;
      expect(body).not.toHaveProperty('factoryZones');
    });

    it('HTTP 錯誤（非 2xx） → BadRequestException', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(500, 'Internal Server Error'));
      await expect(client.createVendor('Test Vendor', ['A廠'], 42)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('400 也拋 BadRequestException', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(400, 'Bad Request'));
      await expect(client.createVendor('X', null, 42)).rejects.toThrow(BadRequestException);
    });

    it('409（userId 已綁定商家） → ConflictException，而非 BadRequestException', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse(409, '此帳號（userId=42）已綁定商家，無法重複建立'),
      );
      await expect(client.createVendor('X', null, 42)).rejects.toThrow(ConflictException);
    });
  });
});
