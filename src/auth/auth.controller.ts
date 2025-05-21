import { Controller, Post, Get, Body, HttpException, HttpStatus, UnauthorizedException, UseGuards, Req, UseInterceptors, UploadedFile, Put, Delete, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from '../users/dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ImageKitService } from '../imagekit/imagekit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly imageKitService: ImageKitService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req: any) {
    try {
      const user = await this.firebaseService.getUserByUid(req.user.uid);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return {
        uid: user.uid,
        email: user.email,
        username: user.username
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      console.log('Received registration request:', {
        ...createUserDto,
        password: '[REDACTED]',
        passwordConfirm: '[REDACTED]'
      });
      
      // Validate input
      if (!createUserDto.email || !createUserDto.password || !createUserDto.username) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          message: 'All fields are required',
        }, HttpStatus.BAD_REQUEST);
      }

      if (!createUserDto.email.includes('@')) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          message: 'Please enter a valid email address',
        }, HttpStatus.BAD_REQUEST);
      }

      if (createUserDto.password.length < 6) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          message: 'Password must be at least 6 characters long',
        }, HttpStatus.BAD_REQUEST);
      }

      if (createUserDto.password !== createUserDto.passwordConfirm) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          message: 'Passwords do not match',
        }, HttpStatus.BAD_REQUEST);
      }

      if (createUserDto.username.length < 3) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          message: 'Username must be at least 3 characters long',
        }, HttpStatus.BAD_REQUEST);
      }

      // Check if email already exists
      const existingUser = await this.firebaseService.getUserByEmail(createUserDto.email);
      if (existingUser) {
        throw new HttpException({
          status: HttpStatus.CONFLICT,
          error: 'Registration failed',
          message: 'Email already exists',
        }, HttpStatus.CONFLICT);
      }

      // Create user in Firebase
      const userRecord = await this.firebaseService.createUserRecord({
        username: createUserDto.username,
        email: createUserDto.email,
        password: createUserDto.password,
      });
      
      console.log('User created successfully:', {
        uid: userRecord.uid,
        email: userRecord.email,
        username: userRecord.username
      });

      // Generate custom token for the new user
      const customToken = await this.firebaseService.createCustomToken(userRecord.uid);
      console.log('Custom token generated successfully');

      // Return user data and custom token
      const response = {
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          username: userRecord.username
        },
        token: customToken
      };

      console.log('Sending registration response:', {
        ...response,
        token: '[REDACTED]'
      });

      return response;
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException({
        status: HttpStatus.BAD_REQUEST,
        error: 'Registration failed',
        message: error.message || 'An error occurred during registration',
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      console.log('Login attempt for email:', loginDto.email);
      
      // Validate input
      if (!loginDto.email || !loginDto.password) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          message: 'Email and password are required',
        }, HttpStatus.BAD_REQUEST);
      }

      if (!loginDto.email.includes('@')) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          message: 'Please enter a valid email address',
        }, HttpStatus.BAD_REQUEST);
      }

      // Verify user and get user data with custom token
      const userData = await this.firebaseService.verifyPassword(loginDto.email, loginDto.password);
      console.log('User verified:', userData.uid);

      // Return user data and custom token
      const response = {
        user: {
          uid: userData.uid,
          email: userData.email,
          username: userData.username
        },
        token: userData.customToken
      };

      console.log('Sending login response:', {
        ...response,
        token: '[REDACTED]'
      });

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Post('upload-photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('photo', {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, callback) => {
      // Accept only image files
      if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp)$/)) {
        return callback(new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          message: 'Only image files are allowed',
        }, HttpStatus.BAD_REQUEST), false);
      }
      callback(null, true);
    },
  }))
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    try {
      if (!file) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          message: 'No file uploaded',
        }, HttpStatus.BAD_REQUEST);
      }

      // Get user ID from request (assuming it's set by auth middleware)
      const userId = req.user?.uid;
      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      console.log('Uploading photo for user:', userId);
      console.log('File details:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      // Upload to ImageKit
      const photoUrl = await this.imageKitService.uploadImage(file, 'profile-photos');
      console.log('Photo uploaded successfully:', photoUrl);

      // Update user profile with new photo URL
      await this.firebaseService.updateUserProfile(userId, {
        photoURL: photoUrl,
      });
      console.log('User profile updated with new photo URL');

      return { photoUrl };
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Upload failed',
        message: error.message || 'Failed to upload photo',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: any,
    @Body() updateData: {
      username?: string;
      email?: string;
      profile?: {
        bio?: string;
        photoURL?: string;
        address?: {
          street?: string;
          city?: string;
          state?: string;
          zipCode?: string;
          country?: string;
          phoneNumber?: string;
        };
      };
      currentPassword?: string;
      newPassword?: string;
    }
  ) {
    try {
      const userId = req.user.uid;
      
      // Update profile in Firestore
      await this.firebaseService.updateUserProfile(userId, {
        bio: updateData.profile?.bio,
        photoURL: updateData.profile?.photoURL,
        address: updateData.profile?.address,
      });

      // Update username and email if provided
      if (updateData.username || updateData.email) {
        await this.firebaseService.updateUser(userId, {
          username: updateData.username,
          email: updateData.email,
        });
      }

      // Update password if provided
      if (updateData.newPassword && updateData.currentPassword) {
        // Verify current password
        const user = await this.firebaseService.getUserByUid(userId);
        if (!user) {
          throw new UnauthorizedException('User not found');
        }

        // Update password in Firebase Auth
        await this.firebaseService.getAuth().updateUser(userId, {
          password: updateData.newPassword,
        });
      }

      // Get updated user data
      const updatedUser = await this.firebaseService.getUserByUid(userId);
      return updatedUser;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new HttpException(
        error.message || 'Failed to update profile',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('photos/:fileId')
  @UseGuards(JwtAuthGuard)
  async deletePhoto(
    @Param('fileId') fileId: string,
    @Req() req: any,
  ) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Delete from ImageKit
      await this.imageKitService.deleteImage(fileId);

      // Get current user data
      const user = await this.firebaseService.getUserByUid(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // If the deleted photo was the profile photo, clear it
      if (user.profile?.photoURL && user.profile.photoURL.includes(fileId)) {
        await this.firebaseService.updateUserProfile(userId, {
          photoURL: null,
        });
      }

      return { message: 'Photo deleted successfully' };
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Delete failed',
        message: error.message || 'Failed to delete photo',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 