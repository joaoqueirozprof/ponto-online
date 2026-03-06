import { IsString, IsOptional, IsNumber, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ example: 'company-id-123' })
  @IsString()
  companyId: string;

  @ApiProperty({ example: 'Sede São Paulo' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'SP-001' })
  @IsString()
  code: string;

  @ApiProperty({
    example: 'Avenida Paulista, 1000',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: '(11) 3000-0001',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: 'America/Sao_Paulo',
    required: false,
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({
    example: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  toleranceMinutes?: number;
}
