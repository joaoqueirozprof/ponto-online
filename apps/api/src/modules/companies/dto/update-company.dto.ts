import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCompanyDto {
  @ApiProperty({ example: 'Tech Solutions LTDA', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '12.345.678/0001-90', required: false })
  @IsOptional()
  @IsString()
  cnpj?: string;

  @ApiProperty({ example: 'Rua das Flores, 100', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '(11) 98765-4321', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'contato@techsolutions.com.br', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;
}
