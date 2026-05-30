import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApplicationsService } from '../applications.service';
import { ReviewApplicationDto } from '../dto/reject-application.dto';
import { ListApplicationsQueryDto } from '../dto/list-applications-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * 福委會後台審核端點。
 * - 整個 Controller 掛 @Roles('admin')，需 API Gateway 驗證 JWT 並注入 x-user-role: admin
 * - 審核者身分由 Gateway 注入的 x-user-id Header 取得，記錄到 reviewed_by
 */
@Controller('api/v1/admin/register/applications')
@Roles('admin')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AdminApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  /**
   * GET /api/v1/admin/register/applications?status=PENDING
   * 列出入駐申請，可依狀態過濾。
   */
  @Get()
  async list(@Query() query: ListApplicationsQueryDto) {
    return this.applicationsService.listForAdmin(query.status);
  }

  /**
   * GET /api/v1/admin/register/applications/:id
   * 取得單筆申請完整內容，含營登 PDF 的短效讀取連結。
   */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.applicationsService.getForAdmin(id);
  }

  /**
   * GET /api/v1/admin/register/applications/:id/document-url
   * 單獨產生營登 PDF 的讀取 Pre-signed URL。
   */
  @Get(':id/document-url')
  async getDocumentUrl(@Param('id') id: string) {
    return this.applicationsService.getDocumentUrl(id);
  }

  /**
   * POST /api/v1/admin/register/applications/:id/approve
   * 核准入駐，並發布 RabbitMQ 事件通知 IAM 與 Vendor 服務建立資料。
   */
  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Headers('x-user-id') reviewedBy: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.applicationsService.approve(id, reviewedBy, dto);
  }

  /**
   * POST /api/v1/admin/register/applications/:id/reject
   * 駁回入駐申請。
   */
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Headers('x-user-id') reviewedBy: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.applicationsService.reject(id, reviewedBy, dto);
  }
}
