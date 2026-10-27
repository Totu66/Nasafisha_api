import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { RequestOtpDto, VerifyOtpDto } from '../access.dto';
import { CitizenService } from './citizen.service';

@Controller('auth/otp')
export class CitizenController {
  constructor(private readonly citizen: CitizenService) {}

  @Post('request')
  @HttpCode(200)
  request(@Body() dto: RequestOtpDto) {
    return this.citizen.requestOtp(dto.email);
  }

  @Post('verify')
  @HttpCode(200)
  verify(@Body() dto: VerifyOtpDto) {
    return this.citizen.verifyOtp(dto.email, dto.code, dto.name);
  }
}
