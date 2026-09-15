import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

// default nest controller (hello world on /)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET / just say hello
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
