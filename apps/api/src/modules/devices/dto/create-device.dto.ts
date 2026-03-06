import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDeviceDto {
  @ApiProperty({ example: 'branch-id-123' })
  @IsString()
  branchId: string;

  @ApiProperty({ example: 'Relógio Digital Entrada' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Control iD 7' })
  @IsString()
  model: string;

  @ApiProperty({ example: 'SN-2024-001' })
  @IsString()
  serialNumber: string;

  @ApiProperty({ example: '192.168.1.100' })
  @IsString()
  ipAddress: string;

  @ApiProperty({ example: 8080 })
  @IsNumber()
  port: number;

  @ApiProperty({ example: 'admin' })
  @IsString()
  login: string;

  @ApiProperty({ example: 'encrypted_password' })
  @IsString()
  encryptedPassword: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
