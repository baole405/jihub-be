import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'newuser@example.com',
    description: 'Registration email address',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'securePassword123',
    description: 'Password (minimum 6 characters)',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @ApiProperty({
    example: 'SE123456',
    description: 'Student ID (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  studentId?: string; // Optional for OAuth users
}
