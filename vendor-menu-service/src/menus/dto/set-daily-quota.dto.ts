import { IsDateString, IsInt, Min } from 'class-validator';

export class SetDailyQuotaDto {
  @IsDateString()
  targetDate: string;

  @IsInt()
  @Min(0)
  maxQuantity: number;
}
