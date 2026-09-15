import { Injectable } from '@nestjs/common';

// default nest service
@Injectable()
export class AppService {
  // return the hello world string
  getHello(): string {
    return 'Hello World!';
  }
}
