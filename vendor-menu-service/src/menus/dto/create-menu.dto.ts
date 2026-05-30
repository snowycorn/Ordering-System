import { IsString, IsNumber, IsOptional, IsUrl, IsInt, Min } from 'class-validator';

export class CreateMenuDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyLimit?: number; // null 表示不限量
}
