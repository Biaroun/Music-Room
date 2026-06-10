"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterDto = void 0;
const class_validator_1 = require("class-validator");
const match_decorator_1 = require("../decorators/match.decorator");
const swagger_1 = require("@nestjs/swagger");
class RegisterDto {
    username;
    email;
    password;
    passwordConfirm;
}
exports.RegisterDto = RegisterDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'johndoe',
        description: 'Between 3 and 255 characters',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(255, { message: "L'username est trop long." }),
    __metadata("design:type", String)
], RegisterDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'john@example.com',
        description: 'Must be a valid email',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: "L'adresse email est obligatoire." }),
    (0, class_validator_1.IsEmail)({}, { message: "L'adresse email n'est pas valide." }),
    (0, class_validator_1.MaxLength)(255, { message: "L'adresse email est trop longue." }),
    __metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Test1234!@#$',
        description: 'Min 12 chars, must contain uppercase, lowercase, number and special char',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Le mot de passe est obligatoire.' }),
    (0, class_validator_1.MinLength)(12, {
        message: 'Le mot de passe doit contenir au moins 12 caractères.',
    }),
    (0, class_validator_1.Matches)(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
        message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.',
    }),
    (0, class_validator_1.MaxLength)(255, { message: 'Le mot de passe est trop long.' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Test1234!@#$',
        description: 'Must match password',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'La confirmation du mot de passe est obligatoire.' }),
    (0, match_decorator_1.Match)('password', { message: 'Les mots de passe ne correspondent pas.' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "passwordConfirm", void 0);
//# sourceMappingURL=register.dto.js.map