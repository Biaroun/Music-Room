import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LogsInterceptor } from './logs/logs.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
  );

  app.useGlobalInterceptors(new LogsInterceptor());

  const config = new DocumentBuilder()
      .setTitle('Music Room API')
      .setDescription('API de Music Room')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  console.log(`🎵 Music Room API running on port ${process.env.PORT ?? 3000}`);
  console.log(
      `📖 Swagger available at http://localhost:${process.env.PORT ?? 3000}/api/docs`,
  );
}
bootstrap();