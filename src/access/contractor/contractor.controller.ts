import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ContractorLoginDto } from '../access.dto';
import { ContractorService } from './contractor.service';

@Controller('auth/contractor')
export class ContractorController {
  constructor(private readonly contractor: ContractorService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: ContractorLoginDto) {
    return this.contractor.login(dto.email, dto.password, dto.deviceId);
  }
}
