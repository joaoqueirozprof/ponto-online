import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'User Name',
    description: 'User full name',
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'User password',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    example: 'role-id-123',
    description: 'Role ID',
  })
  @IsString()
  roleId: string;

  @ApiProperty({
    example: 'branch-id-123',
    description: 'Branch ID (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({
    example: 'company-id-123',
    description: 'Company ID (optional - null for super admin)',
    required: false,
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}
