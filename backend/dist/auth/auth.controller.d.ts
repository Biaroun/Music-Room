import { RegisterDto } from "./dto/register.dto";
import { AuthService } from "./auth.service";
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    create(dto: RegisterDto): Promise<{
        access_token: string;
    }>;
}
