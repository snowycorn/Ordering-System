// src/integrations/mailer.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from './mailer.service';

// nodemailer.createTransport is non-configurable so jest.spyOn won't work.
// Use module-level mock instead.
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));
import * as nodemailer from 'nodemailer';

describe('MailerService', () => {
  afterEach(() => {
    mockSendMail.mockReset();
    (nodemailer.createTransport as jest.Mock).mockClear();
  });

  async function buildService(configOverrides: Record<string, unknown> = {}) {
    const defaults: Record<string, unknown> = {
      SMTP_HOST: undefined,
      SMTP_PORT: 587,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
      EMAIL_FROM: 'no-reply@test.local',
    };
    const config = { ...defaults, ...configOverrides };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: unknown) =>
              config[key] !== undefined ? config[key] : defaultValue,
          },
        },
      ],
    }).compile();

    return module.get(MailerService);
  }

  describe('SMTP_HOST 未設定', () => {
    it('sendWelcomeEmail 只寫 log，不拋出', async () => {
      const service = await buildService({ SMTP_HOST: undefined });
      await expect(
        service.sendWelcomeEmail('v@test.com', 'Vendor A', 'tmp-pw'),
      ).resolves.toBeUndefined();
    });
  });

  describe('SMTP_HOST 已設定', () => {
    it('send 成功時正常完成，不拋出', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'abc' });

      const service = await buildService({ SMTP_HOST: 'smtp.test.com' });
      await expect(
        service.sendWelcomeEmail('v@test.com', 'Vendor A', 'tmp-pw'),
      ).resolves.toBeUndefined();
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'v@test.com' }),
      );
    });

    it('sendMail 拋出時 catch 後不傳播（approve 仍可成功）', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP timeout'));

      const service = await buildService({ SMTP_HOST: 'smtp.test.com' });
      // Should NOT reject — the error is caught internally
      await expect(
        service.sendWelcomeEmail('v@test.com', 'Vendor A', 'tmp-pw'),
      ).resolves.toBeUndefined();
    });

    it('sendMail 收到正確的 from / subject / html', async () => {
      mockSendMail.mockResolvedValue({});

      const service = await buildService({ SMTP_HOST: 'smtp.test.com' });
      await service.sendWelcomeEmail('v@test.com', 'Vendor A', 'tmp-pw');

      const args = mockSendMail.mock.calls[0][0] as nodemailer.SendMailOptions;
      expect(args.from).toBe('no-reply@test.local');
      expect(args.subject).toContain('入駐申請通過');
      expect(args.html).toContain('Vendor A');
      expect(args.html).toContain('tmp-pw');
    });
  });
});
