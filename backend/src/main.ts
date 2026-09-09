import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createServer } from 'net';

// si le port est pris, on prend le suivant
function findAvailablePort(startPort: number, maxAttempts = 20): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number, attemptsLeft: number) => {
      const tester = createServer();
      tester.once('error', (err: NodeJS.ErrnoException) => {
        tester.close();
        if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
          tryPort(port + 1, attemptsLeft - 1);
        } else {
          reject(err);
        }
      });
      tester.once('listening', () => tester.close(() => resolve(port)));
      tester.listen(port, '0.0.0.0');
    };
    tryPort(startPort, maxAttempts);
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
  );

  // LogsInterceptor et AllExceptionsFilter sont poses dans LogsModule : ils
  // injectent LogsService, donc plus instanciables a la main ici

  const config = new DocumentBuilder()
      .setTitle('Music Room API')
      .setDescription('API de Music Room')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const desiredPort = Number(process.env.PORT) || 3000;
  const port = await findAvailablePort(desiredPort);
  if (port !== desiredPort) {
    console.warn(`⚠️  Port ${desiredPort} déjà utilisé, bascule sur le port ${port}`);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`🎵 Music Room API running on port ${port}`);
  console.log(`📖 Swagger available at http://localhost:${port}/api/docs`);
}
bootstrap();