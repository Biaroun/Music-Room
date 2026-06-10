"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogsInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let LogsInterceptor = class LogsInterceptor {
    logger = new common_1.Logger('HTTP');
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const { method, url } = request;
        const start = Date.now();
        this.logger.log(`→ ${method} ${url}`);
        return next.handle().pipe((0, operators_1.tap)(() => {
            const duration = Date.now() - start;
            this.logger.log(`← ${method} ${url} - ${duration}ms`);
        }));
    }
};
exports.LogsInterceptor = LogsInterceptor;
exports.LogsInterceptor = LogsInterceptor = __decorate([
    (0, common_1.Injectable)()
], LogsInterceptor);
//# sourceMappingURL=logs.interceptor.js.map