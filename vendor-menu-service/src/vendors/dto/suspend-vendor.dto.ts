import { IsNotEmpty, IsString } from 'class-validator';

export class SuspendVendorDto {
  // 停權原因必填，確保每次停權都有可追溯理由
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
