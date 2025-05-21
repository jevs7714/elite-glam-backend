import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { PasswordService } from './password.service';

@Module({
  imports: [FirebaseModule],
  controllers: [UsersController],
  providers: [UsersService, PasswordService],
})
export class UsersModule {} 