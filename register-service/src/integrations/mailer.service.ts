// src/integrations/mailer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * 歡迎信寄送服務。
 *
 * 在福委會核准入駐後，寄出包含帳號 email 與初始密碼的歡迎信給新商家。
 * SMTP 設定為選填；若未設定，僅寫入 log 警告，不影響核准流程。
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly emailFrom: string;

  constructor(private readonly config: ConfigService) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    this.emailFrom = this.config.get<string>('EMAIL_FROM', 'no-reply@ordering-system.local');

    if (smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: this.config.get<number>('SMTP_PORT', 587),
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
      this.logger.log(`郵件服務已初始化（SMTP: ${smtpHost}）`);
    } else {
      this.transporter = null;
      this.logger.warn('未設定 SMTP_HOST，歡迎信將只寫入 log（僅限本地開發）');
    }
  }

  /**
   * 寄出入駐核准歡迎信，告知新商家帳號 email 與初始登入密碼。
   * 寄信失敗只記錄錯誤，不丟出例外（不影響核准結果）。
   */
  async sendWelcomeEmail(
    toEmail: string,
    vendorName: string,
    tempPassword: string,
  ): Promise<void> {
    const subject = '【訂餐平台】入駐申請通過，帳號資訊';
    const html = `
      <h2>您好，${vendorName}！</h2>
      <p>您的入駐申請已核准，以下是您的登入資訊：</p>
      <ul>
        <li><strong>帳號（Email）：</strong>${toEmail}</li>
        <li><strong>初始密碼：</strong>${tempPassword}</li>
      </ul>
      <p style="color:red;">⚠️ 請於首次登入後立即前往設定頁面修改密碼。</p>
      <p>如有任何問題，請聯絡福委會。</p>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[本地模擬] 歡迎信 → ${toEmail}｜初始密碼：${tempPassword}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: toEmail,
        subject,
        html,
      });
      this.logger.log(`歡迎信已寄出至 ${toEmail}`);
    } catch (err) {
      this.logger.error(`歡迎信寄送失敗（${toEmail}）：${(err as Error).message}`);
      // 不 rethrow — 信件失敗不影響核准結果，回傳的 tempPassword 可供 admin 備用
    }
  }
}
