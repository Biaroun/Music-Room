import { ApiProperty } from '@nestjs/swagger';
import {
    IsDateString,
    IsEnum,
    IsInt,
    IsLatitude,
    IsLongitude,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    MaxLength,
    ValidateIf,
} from 'class-validator';
import { EventLicenseMode, EventVisibility } from '../event.entity';

export class CreateEventDto {
    @ApiProperty({ example: 'Soiree du samedi' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @ApiProperty({ description: "Id de la playlist a mettre au vote" })
    @IsInt()
    playlistId: number;

    @ApiProperty({ enum: EventVisibility, default: EventVisibility.PUBLIC, required: false })
    @IsOptional()
    @IsEnum(EventVisibility)
    visibility?: EventVisibility;

    @ApiProperty({ enum: EventLicenseMode, default: EventLicenseMode.OPEN, required: false })
    @IsOptional()
    @IsEnum(EventLicenseMode)
    licenseMode?: EventLicenseMode;

    @ApiProperty({ required: false, description: 'Requis si licenseMode = geo-time-restricted' })
    @ValidateIf((o) => o.licenseMode === EventLicenseMode.GEO_TIME_RESTRICTED)
    @IsLatitude()
    licenseLatitude?: number;

    @ApiProperty({ required: false, description: 'Requis si licenseMode = geo-time-restricted' })
    @ValidateIf((o) => o.licenseMode === EventLicenseMode.GEO_TIME_RESTRICTED)
    @IsLongitude()
    licenseLongitude?: number;

    @ApiProperty({ required: false, description: 'Requis si licenseMode = geo-time-restricted' })
    @ValidateIf((o) => o.licenseMode === EventLicenseMode.GEO_TIME_RESTRICTED)
    @IsNumber()
    @IsPositive()
    licenseRadiusMeters?: number;

    @ApiProperty({ required: false, description: 'Requis si licenseMode = geo-time-restricted' })
    @ValidateIf((o) => o.licenseMode === EventLicenseMode.GEO_TIME_RESTRICTED)
    @IsDateString()
    licenseStartsAt?: string;

    @ApiProperty({ required: false, description: 'Requis si licenseMode = geo-time-restricted' })
    @ValidateIf((o) => o.licenseMode === EventLicenseMode.GEO_TIME_RESTRICTED)
    @IsDateString()
    licenseEndsAt?: string;
}
