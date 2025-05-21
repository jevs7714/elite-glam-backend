import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, Delete } from '@nestjs/common';
import { BookingsService, Booking } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { FirebaseService } from '../firebase/firebase.service';
import { UserRecord } from '../firebase/database.types';

interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
  };
}

interface RatingData {
  rating: number;
  comment?: string;
}

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly firebaseService: FirebaseService
  ) {}

  @Get()
  async getAllBookings(@Req() req: AuthenticatedRequest): Promise<Booking[]> {
    // Get user's role from Firebase
    const user = await this.firebaseService.getUserByUid(req.user.uid);
    const isAdmin = user?.role === 'admin';
    
    console.log('User role check:', {
      uid: req.user.uid,
      role: user?.role,
      isAdmin
    });
    
    return this.bookingsService.getAllBookings(req.user.uid, isAdmin);
  }

  @Get('user/:userId')
  async getUserBookings(@Param('userId') userId: string) {
    return this.bookingsService.getUserBookings(userId);
  }

  @Get('seller/:sellerId')
  async getSellerBookings(@Param('sellerId') sellerId: string) {
    return this.bookingsService.getSellerBookings(sellerId);
  }

  @Get(':id')
  async getBookingById(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<Booking> {
    return this.bookingsService.getBookingById(id, req.user.uid);
  }

  @Post()
  async createBooking(
    @Body() bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>,
    @Req() req: AuthenticatedRequest
  ): Promise<Booking> {
    return this.bookingsService.createBooking(bookingData, req.user.uid);
  }

  @Patch(':id/status')
  async updateBookingStatus(
    @Param('id') id: string,
    @Body() body: { status: Booking['status']; message?: string },
    @Req() req: AuthenticatedRequest
  ): Promise<Booking> {
    return this.bookingsService.updateBookingStatus(id, body.status, req.user.uid, body.message);
  }

  @Post(':id/cancel')
  async cancelBooking(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<Booking> {
    return this.bookingsService.cancelBooking(id, req.user.uid);
  }

  @Delete(':id')
  async deleteBooking(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    return this.bookingsService.deleteBooking(id, req.user.uid);
  }

  @Post(':id/rate')
  async submitRating(
    @Param('id') id: string,
    @Body() ratingData: RatingData,
    @Req() req: AuthenticatedRequest
  ): Promise<Booking> {
    return this.bookingsService.submitRating(id, ratingData, req.user.uid);
  }
} 