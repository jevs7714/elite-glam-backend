import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { ImageKitModule } from '../imagekit/imagekit.module';

@Module({
  imports: [FirebaseModule, ImageKitModule],
  controllers: [AuthController],
})
export class AuthModule {} 