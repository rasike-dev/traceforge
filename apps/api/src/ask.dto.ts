import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AskBodyDto {
  @IsString()
  @MaxLength(4000)
  input!: string;

  @IsOptional()
  @IsString()
  tenant?: string;
}

