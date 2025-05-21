import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly firebaseService: FirebaseService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      console.log('No authorization header found');
      throw new UnauthorizedException('No authorization header');
    }

    try {
      // Remove 'Bearer ' prefix if present
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      
      console.log('Verifying token from authorization header...');
      const decodedToken = await this.firebaseService.verifyToken(token);
      
      if (!decodedToken || !decodedToken.uid) {
        throw new UnauthorizedException('Invalid token format');
      }

      // Get user data from Firestore
      const user = await this.firebaseService.getUserByUid(decodedToken.uid);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Set the user in the request object
      request.user = {
        ...decodedToken,
        ...user
      };
      
      console.log('Token verified successfully for user:', decodedToken.uid);
      return true;
    } catch (error) {
      console.error('Token verification failed in JwtAuthGuard:', {
        error: error.message,
        stack: error.stack
      });
      throw new UnauthorizedException('Invalid token');
    }
  }
} 