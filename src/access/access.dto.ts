import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  email: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'The code has 6 digits' })
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class CrewLoginDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4 to 6 digits' })
  pin: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class ResetPinDto {
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4 to 6 digits' })
  pin: string;
}

export class ContractorLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
