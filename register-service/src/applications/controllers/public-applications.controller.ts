import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApplicationsService } from '../applications.service';
import { S3Service } from '../../s3/s3.service';
import { CreateApplicationDto } from '../dto/create-application.dto';
import { GetUploadUrlDto } from '../dto/get-upload-url.dto';

/**
 * 外部商家入駐端點（公開，不需登入）。
 * 流程：先取 upload-url 上傳 PDF → 送出申請表單 → 憑回傳的 id 查詢進度。
 *
 * 整個 Controller 不掛 @Roles()，RolesGuard 一律放行；
 * 透過 @Throttle 與 Kong 的 IP rate-limiting 防止濫用 pre-signed URL 額度與灌申請。
 */
@Controller('api/v1/register')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PublicApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * GET /api/v1/register/upload-url?contentType=application/pdf
   *
   * 取得一組具時效（5 分鐘）的 S3 Pre-signed PUT URL，讓前端直接上傳營登 PDF：
   * 1. 前端帶 contentType 呼叫本端點
   * 2. 後端回傳 { uploadUrl, documentKey }
   * 3. 前端對 uploadUrl 發 HTTP PUT 上傳 PDF（檔案不經過後端）
   * 4. 前端把 documentKey 帶入送出申請的 API
   *
   * @Throttle：限制同一 IP 每分鐘最多 5 次，防止濫用 pre-signed URL。
   */
  @Get('upload-url')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async getUploadUrl(@Query() query: GetUploadUrlDto) {
    return this.s3Service.generateDocumentUploadUrl(query.contentType);
  }

  /**
   * POST /api/v1/register/applications
   * 送出入駐申請，回傳隨機 Key（id）供後續查詢進度。
   */
  @Post('applications')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async create(@Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(dto);
  }

  /**
   * GET /api/v1/register/applications/:id
   * 申請人憑 id 查詢自己的審核進度（僅回傳必要欄位）。
   */
  @Get('applications/:id')
  async getStatus(@Param('id') id: string) {
    return this.applicationsService.getPublicStatus(id);
  }
}
