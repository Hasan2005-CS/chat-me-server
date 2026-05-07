import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logger/logger.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(new AppLogger());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? 'https://chat-me.app'
      : 'http://localhost:5173',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('ChatMe API')
    .setDescription('API documentation for ChatMe application')
    .setVersion('1.0')
    .setExternalDoc('GitHub Repository', 'https://github.com/Hasan2005-CS/chat-me-server')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Chat-Me API Documentation',
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');

  await app.listen(port as number);
  console.log(`Server running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();