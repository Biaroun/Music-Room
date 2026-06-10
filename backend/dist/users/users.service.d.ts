import { Repository } from 'typeorm';
import { User } from './user.entity';
export declare class UsersService {
    private userRepository;
    constructor(userRepository: Repository<User>);
    findByEmail(email: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    create(data: Partial<User>): Promise<User>;
    isAlreadyExist(field: 'email' | 'username', value: string): Promise<boolean>;
}
