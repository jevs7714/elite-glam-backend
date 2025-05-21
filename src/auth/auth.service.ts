import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { UserRecord } from '../firebase/database.types';

@Injectable()
export class AuthService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async validateUser(email: string, password: string): Promise<UserRecord> {
    try {
      return await this.firebaseService.verifyPassword(email, password);
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async verifyToken(token: string): Promise<any> {
    try {
      return await this.firebaseService.verifyToken(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
} 