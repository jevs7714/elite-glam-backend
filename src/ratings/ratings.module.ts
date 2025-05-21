import { Module } from '@nestjs/common';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseService } from '../firebase/firebase.service';

@Module({
  imports: [FirebaseModule],
  controllers: [RatingsController],
  providers: [RatingsService, FirebaseService],
  exports: [RatingsService],
})
export class RatingsModule {} 