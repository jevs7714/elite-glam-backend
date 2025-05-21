import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { RatingsService, Rating } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { FirebaseService } from '../firebase/firebase.service';

interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
  };
}

interface CreateRatingDto {
  productId: string;
  rating: number;
  comment?: string;
  bookingId?: string;
}

interface UpdateRatingDto {
  rating?: number;
  comment?: string;
}

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(
    private readonly ratingsService: RatingsService,
    private readonly firebaseService: FirebaseService
  ) {}

  @Post()
  async createRating(
    @Body() createRatingDto: CreateRatingDto,
    @Req() req: AuthenticatedRequest
  ): Promise<Rating> {
    // Get user data from request
    const userData = req.user;
    
    // Fetch user profile to get username
    const userDoc = await this.firebaseService.getDocument('users', userData.uid);
    const userProfile = await userDoc.get();
    const username = userProfile.exists ? userProfile.data()?.username || 'Anonymous' : 'Anonymous';
    
    return this.ratingsService.createRating({
      ...createRatingDto,
      userId: userData.uid,
      userName: username,
    });
  }

  @Get('product/:productId')
  async getProductRatings(@Param('productId') productId: string): Promise<Rating[]> {
    return this.ratingsService.getProductRatings(productId);
  }

  @Get('user')
  async getUserRatings(@Req() req: AuthenticatedRequest): Promise<Rating[]> {
    return this.ratingsService.getUserRatings(req.user.uid);
  }

  @Get(':id')
  async getRatingById(@Param('id') id: string): Promise<Rating> {
    return this.ratingsService.getRatingById(id);
  }

  @Put(':id')
  async updateRating(
    @Param('id') id: string,
    @Body() updateRatingDto: UpdateRatingDto,
    @Req() req: AuthenticatedRequest
  ): Promise<Rating> {
    return this.ratingsService.updateRating(id, updateRatingDto, req.user.uid);
  }

  @Delete(':id')
  async deleteRating(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest
  ): Promise<void> {
    return this.ratingsService.deleteRating(id, req.user.uid);
  }

  @Get('product/:productId/average')
  async getProductAverageRating(@Param('productId') productId: string): Promise<{ average: number }> {
    const average = await this.ratingsService.getProductAverageRating(productId);
    return { average };
  }
} 