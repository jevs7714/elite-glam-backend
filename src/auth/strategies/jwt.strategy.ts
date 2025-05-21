import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly firebaseService: FirebaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'firebase', // This is just a placeholder since we're using Firebase tokens
    });
  }

  async validate(payload: any) {
    try {
      // The payload is already the Firebase token
      const decodedToken = await this.firebaseService.verifyToken(payload);
      return decodedToken;
    } catch (error) {
      return null;
    }
  }
} 