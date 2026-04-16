import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ZodValidationPipe());

  app.enableCors();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');
  app.use(cookieParser());

  await app.listen(port as number);
  console.log(`🚀 Server running on http://localhost:${port}/api/v1`);
}

bootstrap();
