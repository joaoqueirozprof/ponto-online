import { IsString, IsOptional, IsDate, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'branch-id-123' })
  @IsString()
  branchId: string;

  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  name: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  cpf: string;

  @ApiProperty({ example: '123456789', required: false })
  @IsOptional()
  @IsString()
  pis?: string;

  @ApiProperty({ example: '001', required: false })
  @IsOptional()
  @IsString()
  registration?: string;

  @ApiProperty({ example: 'joao.silva@example.com', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: '(11) 98765-1234', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Desenvolvedor', required: false })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({ example: 'Tecnologia', required: false })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ example: 'schedule-id-123', required: false })
  @IsOptional()
  @IsString()
  scheduleId?: string;

  @ApiProperty({ example: '2022-01-15' })
  @Type(() => Date)
  @IsDate()
  admissionDate: Date;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  terminationDate?: Date;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 'device-user-123', required: false })
  @IsOptional()
  @IsString()
  deviceUserId?: string;
}
