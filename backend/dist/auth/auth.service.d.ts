import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from "@nestjs/jwt";
export declare class AuthService {
    private usersService;
    private jwtservice;
    constructor(usersService: UsersService, jwtservice: JwtService);
    register(data: RegisterDto): Promise<{
        access_token: string;
    }>;
}
