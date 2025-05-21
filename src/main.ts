import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  
  // Log environment configuration
  console.log('Environment Configuration:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('Firebase Config Available:', {
    projectId: !!configService.get('FIREBASE_PROJECT_ID'),
    clientEmail: !!configService.get('FIREBASE_CLIENT_EMAIL'),
    privateKey: !!configService.get('FIREBASE_PRIVATE_KEY'),
    storageBucket: !!configService.get('FIREBASE_STORAGE_BUCKET'),
    databaseURL: !!configService.get('FIREBASE_DATABASE_URL'),
  });
  
  // Enable CORS with all necessary development URLs
  app.enableCors({
    origin: '*', // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Platform', 'X-Device-Version'],
    exposedHeaders: ['Content-Type', 'Authorization'],
  });

  // Enable validation with detailed error messages
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
    disableErrorMessages: false,
    validationError: {
      target: false,
      value: false,
    },
  }));

  // Serve static files from uploads directory
  const uploadsPath = join(__dirname, '..', 'uploads');
  console.log('Serving static files from:', uploadsPath);
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
    setHeaders: (res, path) => {
      // Set cache control headers for images
      if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png') || path.endsWith('.gif')) {
        res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      }
    },
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}
bootstrap();
