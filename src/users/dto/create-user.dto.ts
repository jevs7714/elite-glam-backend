import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from './password.validator';
import { Match } from './match.decorator';

export class CreateUserDto {
  @IsString()
  @MinLength(2, { message: 'Username must be at least 2 characters long' })
  username: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsStrongPassword()
  password: string;

  @IsString()
  @Match('password', { message: 'Passwords do not match' })
  passwordConfirm: string;
} 