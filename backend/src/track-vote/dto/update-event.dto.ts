import { ApiProperty } from '@nestjs/swagger';
import {
    IsDateString,
    IsEnum,
    IsLatitude,
    IsLongitude,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    MaxLength,
} from 'class-validator';
import { EventLicenseMode, EventVisibility } from '../event.entity';

export class UpdateEventDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    @ApiProperty({ enum: EventVisibility, required: false })
    @IsOptional()
    @IsEnum(EventVisibility)
    visibility?: EventVisibility;

    @ApiProperty({ enum: EventLicenseMode, required: false })
    @IsOptional()
    @IsEnum(EventLicenseMode)
    licenseMode?: EventLicenseMode;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsLatitude()
    licenseLatitude?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsLongitude()
    licenseLongitude?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @IsPositive()
    licenseRadiusMeters?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    licenseStartsAt?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    licenseEndsAt?: string;
}
