import { BadRequestException } from '@nestjs/common';

/**
 * 把 Gateway 注入的 x-user-id（IAM 數字 userId，字串型別）解析成整數。
 * 缺少或非數字時丟 400，避免把 NaN 餵給 Prisma 產生難解的錯誤。
 */
export function parseXUserId(header: string | undefined): number {
  const userId = Number(header);
  if (!header || !Number.isInteger(userId)) {
    throw new BadRequestException('缺少或無效的 x-user-id Header，請透過 API Gateway 存取');
  }
  return userId;
}
