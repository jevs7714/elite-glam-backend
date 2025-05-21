import { Injectable, ConflictException, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PasswordService } from './password.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UserRecord } from '../firebase/database.types';

@Injectable()
export class UsersService {
  constructor(
    private firebaseService: FirebaseService,
    private passwordService: PasswordService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<UserRecord> {
    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(
      createUserDto.password
    );

    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.message);
    }

    // Validate password confirmation
    if (createUserDto.password !== createUserDto.passwordConfirm) {
      throw new BadRequestException('Passwords do not match');
    }

    try {
      const userRecord = await this.firebaseService.createUserRecord({
        username: createUserDto.username,
        email: createUserDto.email,
        password: createUserDto.password,
      });

      return userRecord;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.code === 'auth/email-already-exists') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async getUserById(userId: string) {
    try {
      const user = await this.firebaseService.getUserByUid(userId);
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      throw new NotFoundException('User not found');
    }
  }

  async getUserByUsername(username: string) {
    try {
      const usersRef = await this.firebaseService.getCollection('users');
      const snapshot = await usersRef
        .where('username', '==', username)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new NotFoundException('User not found');
      }

      const userDoc = snapshot.docs[0];
      return {
        uid: userDoc.id,
        ...userDoc.data()
      };
    } catch (error) {
      console.error('Error getting user by username:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('User not found');
    }
  }

  async login(loginUserDto: LoginUserDto) {
    try {
      const auth = this.firebaseService.getAuth();
      
      // Verify the email exists
      const userRecord = await auth.getUserByEmail(loginUserDto.email);
      
      if (!userRecord) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Create a custom token
      const customToken = await auth.createCustomToken(userRecord.uid);
      
      // Get user data from Firestore
      const userData = await this.firebaseService.getUserByUid(userRecord.uid);
      
      if (!userData) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return {
        user: {
          uid: userData.uid,
          username: userData.username,
          email: userData.email,
        },
        token: customToken,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }
} 