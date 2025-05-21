import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase-admin/firestore';

export interface Rating {
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  customerName: string;
  serviceName: string;
  productId: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
  price: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  uid: string;        // ID of the customer who made the booking
  ownerUid: string;   // ID of the seller who owns the product
  sellerLocation?: string;
  productImage?: string;
  ownerUsername: string;
  rating?: Rating;
  eventTimePeriod?: string;
  eventType?: string;
  fittingTime?: string;
  fittingTimePeriod?: string;
  eventLocation?: string;
  rejectionMessage?: string;
}

interface BookingData {
  customerName: string;
  serviceName: string;
  productId: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
  price: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  uid: string;
  ownerUid: string;
  sellerLocation?: string;
  productImage?: string;
  rating?: Rating;
  eventTimePeriod?: string;
  eventType?: string;
  fittingTime?: string;
  fittingTimePeriod?: string;
  eventLocation?: string;
  rejectionMessage?: string;
}

@Injectable()
export class BookingsService {
  private readonly collection = 'bookings';

  constructor(private readonly firebaseService: FirebaseService) {}

  async getAllBookings(userId: string, isAdmin: boolean = false): Promise<Booking[]> {
    try {
      console.log(`Fetching bookings for user: ${userId}, isAdmin: ${isAdmin}`);
      const bookingsRef = await this.firebaseService.getCollection(this.collection);
      
      // If user is admin, return all bookings
      if (isAdmin) {
          const snapshot = await bookingsRef
            .orderBy('createdAt', 'desc')
            .get();
          
          return snapshot.docs.map(doc => {
            const data = doc.data() as BookingData;
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt.toDate(),
              updatedAt: data.updatedAt.toDate(),
            } as Booking;
          });
      }
      
      // For regular users, return bookings where they are either the customer or the seller
      try {
        // Get all bookings where user is the customer
        const customerBookings = await bookingsRef
          .where('uid', '==', userId)
          .get();
        
        console.log('Customer bookings found:', {
          userId,
          count: customerBookings.docs.length,
          bookings: customerBookings.docs.map(doc => ({
            id: doc.id,
            customerName: doc.data().customerName,
            status: doc.data().status,
            uid: doc.data().uid,
            ownerUid: doc.data().ownerUid
          }))
        });
        
        // Get all bookings where user is the seller
        const sellerBookings = await bookingsRef
          .where('ownerUid', '==', userId)
          .get();
        
        console.log('Seller bookings found:', {
          userId,
          count: sellerBookings.docs.length,
          bookings: sellerBookings.docs.map(doc => ({
            id: doc.id,
            customerName: doc.data().customerName,
            status: doc.data().status,
            uid: doc.data().uid,
            ownerUid: doc.data().ownerUid
          }))
        });
        
        // Combine and sort the results
        const allBookings = [
          ...customerBookings.docs.map(doc => {
            const data = doc.data() as BookingData;
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt.toDate(),
              updatedAt: data.updatedAt.toDate(),
            } as Booking;
          }),
          ...sellerBookings.docs.map(doc => {
            const data = doc.data() as BookingData;
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt.toDate(),
              updatedAt: data.updatedAt.toDate(),
            } as Booking;
          })
        ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        console.log('Total bookings found:', allBookings.length);
        return allBookings;
      } catch (error) {
        console.error('Error fetching customer bookings:', error);
        throw new InternalServerErrorException('Failed to fetch bookings');
      }
    } catch (error) {
      console.error('Error in getAllBookings:', error);
      throw new InternalServerErrorException('Failed to fetch bookings');
    }
  }

  async getUserBookings(userId: string) {
    try {
      console.log(`Fetching bookings for user: ${userId}`);
      const bookingsRef = await this.firebaseService.getCollection('bookings');
        const snapshot = await bookingsRef
        .where('uid', '==', userId)
          .get();
        
      if (snapshot.empty) {
        console.log('No bookings found for user:', userId);
        return [];
      }

      const bookings = snapshot.docs.map(doc => {
          const data = doc.data() as BookingData;
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
          } as Booking;
        });

      // Sort the bookings in memory instead of in the query
      bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      console.log(`Found ${bookings.length} bookings for user:`, userId);
      return bookings;
    } catch (error) {
      console.error('Error getting user bookings:', error);
      throw new InternalServerErrorException('Failed to fetch user bookings');
    }
  }

  async getSellerBookings(sellerId: string) {
    try {
      console.log(`Fetching bookings for seller: ${sellerId}`);
      const bookingsRef = await this.firebaseService.getCollection('bookings');
        const snapshot = await bookingsRef
        .where('ownerUid', '==', sellerId)
          .get();
        
      if (snapshot.empty) {
        console.log('No bookings found for seller:', sellerId);
        return [];
      }

      const bookings = snapshot.docs.map(doc => {
          const data = doc.data() as BookingData;
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
          } as Booking;
      });

      // Sort the bookings in memory instead of in the query
      bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      console.log(`Found ${bookings.length} bookings for seller:`, sellerId);
      return bookings;
    } catch (error) {
      console.error('Error getting seller bookings:', error);
      throw new InternalServerErrorException('Failed to fetch seller bookings');
    }
  }

  async getBookingById(id: string, uid: string): Promise<Booking> {
    try {
      console.log(`Fetching booking with ID: ${id} for user: ${uid}`);
      const doc = await this.firebaseService.getDocument(this.collection, id);
      const data = await doc.get();
      
      if (!data.exists) {
        throw new NotFoundException(`Booking with ID ${id} not found`);
      }

      const docData = data.data() as BookingData;
      if (docData.uid !== uid && docData.ownerUid !== uid) {
        throw new ForbiddenException('You do not have permission to access this booking');
      }

      // Fetch the owner's username from the users collection
      const ownerDoc = await this.firebaseService.getDocument('users', docData.ownerUid);
      const ownerData = await ownerDoc.get();
      const ownerUsername = ownerData.exists ? ownerData.data().username : 'Unknown';

      return {
        id: data.id,
        ...docData,
        ownerUsername,
        createdAt: docData.createdAt.toDate(),
        updatedAt: docData.updatedAt.toDate(),
      } as Booking;
    } catch (error) {
      console.error('Error fetching booking:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch booking');
    }
  }

  async createBooking(bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>, uid: string): Promise<Booking> {
    try {
      console.log(`Creating booking for user: ${uid}`, bookingData);
      const id = uuidv4();
      const now = new Date();
      
      // Ensure ownerUid is included in the booking data
      if (!bookingData.ownerUid) {
        throw new Error('ownerUid is required for creating a booking');
      }

      // Ensure uid matches the authenticated user
      if (bookingData.uid !== uid) {
        throw new ForbiddenException('Cannot create booking for another user');
      }

      // Create a clean booking object with only the fields we need
      const booking: Booking = {
        id,
        customerName: bookingData.customerName,
        serviceName: bookingData.serviceName,
        productId: bookingData.productId,
        date: bookingData.date,
        time: bookingData.time,
        status: bookingData.status,
        price: bookingData.price,
        notes: bookingData.notes,
        uid: bookingData.uid,
        ownerUid: bookingData.ownerUid,
        sellerLocation: bookingData.sellerLocation,
        productImage: bookingData.productImage,
        createdAt: now,
        updatedAt: now,
        ownerUsername: '',
        eventTimePeriod: bookingData.eventTimePeriod,
        eventType: bookingData.eventType,
        fittingTime: bookingData.fittingTime,
        fittingTimePeriod: bookingData.fittingTimePeriod,
        eventLocation: bookingData.eventLocation
      };

      console.log('Saving booking to database:', {
        id: booking.id,
        uid: booking.uid,
        ownerUid: booking.ownerUid,
        status: booking.status,
        serviceName: booking.serviceName
      });

      await this.firebaseService.addDocument(this.collection, booking);
      return booking;
    } catch (error) {
      console.error('Error creating booking:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create booking');
    }
  }

  async updateBookingStatus(id: string, status: Booking['status'], uid: string, message?: string): Promise<Booking> {
    try {
      console.log(`Updating booking status for ID: ${id}, user: ${uid}`);
      const doc = await this.firebaseService.getDocument(this.collection, id);
      const data = await doc.get();
      
      if (!data.exists) {
        throw new NotFoundException(`Booking with ID ${id} not found`);
      }

      const docData = data.data() as BookingData;
      if (docData.uid !== uid && docData.ownerUid !== uid) {
        throw new ForbiddenException('You do not have permission to update this booking');
      }

      const updateData = {
        status,
        updatedAt: new Date(),
        ...(status === 'rejected' && message ? { rejectionMessage: message } : {})
      };

      await this.firebaseService.updateDocument(this.collection, id, updateData);

      // Fetch and return the updated booking
      const updatedDoc = await this.firebaseService.getDocument(this.collection, id);
      const updatedData = await updatedDoc.get();
      const updatedDocData = updatedData.data() as BookingData;

      return {
        id: updatedData.id,
        ...updatedDocData,
        createdAt: updatedDocData.createdAt.toDate(),
        updatedAt: updatedDocData.updatedAt.toDate(),
      } as Booking;
    } catch (error) {
      console.error('Error updating booking status:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update booking status');
    }
  }

  async cancelBooking(id: string, uid: string): Promise<Booking> {
    return this.updateBookingStatus(id, 'cancelled', uid);
  }

  async deleteBooking(id: string, uid: string): Promise<{ message: string }> {
    try {
      const doc = await this.firebaseService.getDocument(this.collection, id);
      const data = await doc.get();
      
      if (!data.exists) {
        throw new NotFoundException(`Booking with ID ${id} not found`);
      }

      const docData = data.data() as BookingData;
      if (docData.uid !== uid && docData.ownerUid !== uid) {
        throw new ForbiddenException('You do not have permission to delete this booking');
      }

      await this.firebaseService.delete(this.collection, id);
      return { message: 'Booking deleted successfully' };
    } catch (error) {
      console.error('Error deleting booking:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete booking');
    }
  }

  async submitRating(id: string, ratingData: Omit<Rating, 'createdAt' | 'updatedAt'>, uid: string): Promise<Booking> {
    try {
      console.log(`Submitting rating for booking ID: ${id}, user: ${uid}`);
      const doc = await this.firebaseService.getDocument(this.collection, id);
      const data = await doc.get();
      
      if (!data.exists) {
        throw new NotFoundException(`Booking with ID ${id} not found`);
      }

      const docData = data.data() as BookingData;
      if (docData.uid !== uid) {
        throw new ForbiddenException('Only the customer who made the booking can submit a rating');
      }

      if (docData.status !== 'confirmed') {
        throw new ForbiddenException('Can only rate confirmed bookings');
      }

      const now = new Date();
      const rating: Rating = {
        ...ratingData,
        createdAt: now,
        updatedAt: now,
      };

      const updateData = {
        rating,
        updatedAt: now,
      };

      await this.firebaseService.updateDocument(this.collection, id, updateData);

      // Fetch and return the updated booking
      const updatedDoc = await this.firebaseService.getDocument(this.collection, id);
      const updatedData = await updatedDoc.get();
      const updatedDocData = updatedData.data() as BookingData;

      return {
        id: updatedData.id,
        ...updatedDocData,
        createdAt: updatedDocData.createdAt.toDate(),
        updatedAt: updatedDocData.updatedAt.toDate(),
      } as Booking;
    } catch (error) {
      console.error('Error submitting rating:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to submit rating');
    }
  }
} 