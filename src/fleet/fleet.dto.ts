import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  plate: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsOptional()
  @IsString()
  crewId?: string;

  @IsOptional()
  @IsString()
  zone?: string;
}

export class AssignVehicleDto {
  @IsString()
  @IsNotEmpty()
  crewId: string;
}

export class CreateRouteDto {
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsDateString()
  shiftStart: string;

  @IsDateString()
  shiftEnd: string;

  @IsArray()
  @ArrayMinSize(2)
  plannedPath: number[][];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  plannedMinutes: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  thresholdMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  thresholdMinutes?: number;

  @IsOptional()
  @IsString()
  zone?: string;
}
