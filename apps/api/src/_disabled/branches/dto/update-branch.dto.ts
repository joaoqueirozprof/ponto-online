import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBranchDto {
  @ApiProperty({ example: 'Sede São Paulo', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'SP-001', required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Avenida Paulista, 1000', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '(11) 3000-0001', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'America/Sao_Paulo', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber()
  toleranceMinutes?: number;
}
