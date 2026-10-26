import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PhotoLocationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}

export class CreateReportDto extends PhotoLocationDto {
  @IsIn(['missed_collection', 'illegal_dumping'])
  issueType: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class AssignTicketDto {
  @IsString()
  @IsNotEmpty()
  crewId: string;
}

export class RemediationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note: string;
}
