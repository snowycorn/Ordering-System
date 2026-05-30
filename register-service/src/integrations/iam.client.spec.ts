// src/integrations/iam.client.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IamClient } from './iam.client';

// ── Helper: build a mock Response ─────────────────────────────────────────────

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IamClient', () => {
  let client: IamClient;
  let fetchSpy: jest.SpyInstance;

  const configValues: Record<string, string> = {
    IAM_SERVICE_URL: 'http://iam-service:3001',
    INTERNAL_ADMIN_EMAIL: 'admin@test.com',
    INTERNAL_ADMIN_PASSWORD: 'secret',
  };

  beforeEach(async () => {
    // Reset fetch spy before each test
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() => {
      throw new Error('fetch not mocked for this test');
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IamClient,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              configValues[key] ?? defaultValue,
          },
        },
      ],
    }).compile();

    client = module.get(IamClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Token caching (tested indirectly via createVendorUser) ────────────────

  describe('Token caching', () => {
    it('第一次呼叫打 /auth/login 取得 token', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(200, { token: 'jwt-token-1' })) // login
        .mockResolvedValueOnce(mockResponse(201, {})); // createVendorUser

      await client.createVendorUser('vendor@test.com', 'pass');

      const loginCall = fetchSpy.mock.calls[0];
      expect(loginCall[0]).toContain('/auth/login');
    });

    it('快取有效時不再打 /auth/login（兩次呼叫只登入一次）', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(200, { token: 'jwt-token-1' })) // login (once)
        .mockResolvedValue(mockResponse(201, {})); // createVendorUser (twice)

      await client.createVendorUser('a@test.com', 'p1');
      await client.createVendorUser('b@test.com', 'p2');

      const loginCalls = fetchSpy.mock.calls.filter((c) =>
        (c[0] as string).includes('/auth/login'),
      );
      expect(loginCalls).toHaveLength(1);
    });

    it('login 失敗（non-2xx）→ BadRequestException', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(401, 'Unauthorized'));

      await expect(client.createVendorUser('vendor@test.com', 'wrong')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── createVendorUser() ────────────────────────────────────────────────────

  describe('createVendorUser()', () => {
    beforeEach(() => {
      // pre-fill token cache so tests don't need to mock login each time
      fetchSpy
        .mockResolvedValueOnce(mockResponse(200, { token: 'cached-token' }));
    });

    it('201 成功時回傳 IAM 數字 userId', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, { id: 42, email: 'v@test.com' }));
      await expect(client.createVendorUser('v@test.com', 'pw')).resolves.toBe(42);
    });

    it('409 Conflict（email 已存在）→ ConflictException，不再冪等重試', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(409, { message: 'already exists' }));
      await expect(client.createVendorUser('v@test.com', 'pw')).rejects.toThrow(
        ConflictException,
      );
      // 不應再額外打 GET /users（login + POST /users 共 2 次）
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('500 錯誤 → BadRequestException', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(500, 'Internal Server Error'));
      await expect(client.createVendorUser('v@test.com', 'pw')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('呼叫 POST /users 時帶有 Authorization header', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, {}));
      await client.createVendorUser('v@test.com', 'pw');

      const userCall = fetchSpy.mock.calls.find((c) =>
        (c[0] as string).includes('/users'),
      );
      expect(userCall).toBeDefined();
      const options = userCall![1] as RequestInit;
      expect((options.headers as Record<string, string>)['Authorization']).toMatch(
        /^Bearer /,
      );
    });
  });

  // ── Gateway identity headers（直連 IAM 受保護端點時需補上）─────────────────
  describe('Gateway identity headers', () => {
    it('POST /users 帶上 X-User-Role: admin 與由 login 回應取得的 X-User-Id / X-User-Email', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          mockResponse(200, {
            token: 'jwt',
            userId: 99,
            role: 'admin',
            email: 'admin@test.com',
          }),
        ) // login
        .mockResolvedValueOnce(mockResponse(201, { id: 42 })); // POST /users

      await client.createVendorUser('v@test.com', 'pw');

      const userCall = fetchSpy.mock.calls.find((c) =>
        (c[0] as string).endsWith('/users'),
      );
      const headers = (userCall![1] as RequestInit).headers as Record<string, string>;
      expect(headers['X-User-Role']).toBe('admin');
      expect(headers['X-User-Id']).toBe('99');
      expect(headers['X-User-Email']).toBe('admin@test.com');
    });
  });

  // ── deleteUser()（補償用）──────────────────────────────────────────────────
  describe('deleteUser()', () => {
    beforeEach(() => {
      // pre-fill token cache（同 createVendorUser 的模式）
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { token: 'cached-token' }));
    });

    it('成功（2xx）時對 /users/:id 發 DELETE、帶 admin 身份 header', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(204, ''));
      await expect(client.deleteUser(42)).resolves.toBeUndefined();

      const delCall = fetchSpy.mock.calls.find((c) =>
        (c[0] as string).endsWith('/users/42'),
      );
      expect(delCall).toBeDefined();
      const options = delCall![1] as RequestInit;
      expect(options.method).toBe('DELETE');
      expect((options.headers as Record<string, string>)['X-User-Role']).toBe('admin');
    });

    it('非 2xx → BadRequestException', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(500, 'boom'));
      await expect(client.deleteUser(42)).rejects.toThrow(BadRequestException);
    });
  });
});
