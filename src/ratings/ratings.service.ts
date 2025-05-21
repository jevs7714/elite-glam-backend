import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase-admin/firestore';

export interface Rating {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
  bookingId?: string;  // Optional reference to the booking
}

interface RatingData {
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  bookingId?: string;
}

@Injectable()
export class RatingsService {
  private readonly collection = 'ratings';

  constructor(private readonly firebaseService: FirebaseService) {}

  async createRating(ratingData: Omit<Rating, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rating> {
    try {
      console.log('Creating rating:', ratingData);
      const id = uuidv4();
      const now = new Date();

      const rating: Rating = {
        id,
        ...ratingData,
        createdAt: now,
        updatedAt: now,
      };

      await this.firebaseService.addDocument(this.collection, rating);
      return rating;
    } catch (error) {
      console.error('Error creating rating:', error);
      throw new InternalServerErrorException('Failed to create rating');
    }
  }

  async getProductRatings(productId: string): Promise<Rating[]> {
    try {
      console.log(`Fetching ratings for product: ${productId}`);
      const ratingsRef = await this.firebaseService.getCollection(this.collection);
      
      // Use a simpler query that only filters by productId
          const snapshot = await ratingsRef
            .where('productId', '==', productId)
            .get();

          if (snapshot.empty) {
            return [];
          }

      // Sort the results in memory after fetching
          const ratings = snapshot.docs.map(doc => {
            const data = doc.data() as RatingData;
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt.toDate(),
              updatedAt: data.updatedAt.toDate(),
            } as Rating;
          });

      // Sort by createdAt in descending order
          return ratings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error fetching product ratings:', error);
      throw new InternalServerErrorException('Failed to fetch product ratings');
    }
  }

  async getUserRatings(userId: string): Promise<Rating[]> {
    try {
      console.log(`Fetching ratings by user: ${userId}`);
      const ratingsRef = await this.firebaseService.getCollection(this.collection);
      const snapshot = await ratingsRef
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      if (snapshot.empty) {
        return [];
      }

      return snapshot.docs.map(doc => {
        const data = doc.data() as RatingData;
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Rating;
      });
    } catch (error) {
      console.error('Error fetching user ratings:', error);
      throw new InternalServerErrorException('Failed to fetch user ratings');
    }
  }

  async getRatingById(id: string): Promise<Rating> {
    try {
      console.log(`Fetching rating with ID: ${id}`);
      const doc = await this.firebaseService.getDocument(this.collection, id);
      const data = await doc.get();

      if (!data.exists) {
        throw new NotFoundException(`Rating with ID ${id} not found`);
      }

      const docData = data.data() as RatingData;
      return {
        id: data.id,
        ...docData,
        createdAt: docData.createdAt.toDate(),
        updatedAt: docData.updatedAt.toDate(),
      } as Rating;
    } catch (error) {
      console.error('Error fetching rating:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch rating');
    }
  }

  async updateRating(id: string, ratingData: Partial<Rating>, userId: string): Promise<Rating> {
    try {
      console.log(`Updating rating: ${id}`);
      const doc = await this.firebaseService.getDocument(this.collection, id);
      const data = await doc.get();

      if (!data.exists) {
        throw new NotFoundException(`Rating with ID ${id} not found`);
      }

      const docData = data.data() as RatingData;
      if (docData.userId !== userId) {
        throw new ForbiddenException('You do not have permission to update this rating');
      }

      const updateData = {
        ...ratingData,
        updatedAt: new Date(),
      };

      await this.firebaseService.updateDocument(this.collection, id, updateData);

      // Fetch and return the updated rating
      const updatedDoc = await this.firebaseService.getDocument(this.collection, id);
      const updatedData = await updatedDoc.get();
      const updatedDocData = updatedData.data() as RatingData;

      return {
        id: updatedData.id,
        ...updatedDocData,
        createdAt: updatedDocData.createdAt.toDate(),
        updatedAt: updatedDocData.updatedAt.toDate(),
      } as Rating;
    } catch (error) {
      console.error('Error updating rating:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update rating');
    }
  }

  async deleteRating(id: string, userId: string): Promise<void> {
    try {
      console.log(`Deleting rating: ${id}`);
      const doc = await this.firebaseService.getDocument(this.collection, id);
      const data = await doc.get();

      if (!data.exists) {
        throw new NotFoundException(`Rating with ID ${id} not found`);
      }

      const docData = data.data() as RatingData;
      if (docData.userId !== userId) {
        throw new ForbiddenException('You do not have permission to delete this rating');
      }

      await this.firebaseService.delete(this.collection, id);
    } catch (error) {
      console.error('Error deleting rating:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete rating');
    }
  }

  async getProductAverageRating(productId: string): Promise<number> {
    try {
      const ratings = await this.getProductRatings(productId);
      if (ratings.length === 0) {
        return 0;
      }

      const sum = ratings.reduce((acc, curr) => acc + curr.rating, 0);
      return sum / ratings.length;
    } catch (error) {
      console.error('Error calculating average rating:', error);
      throw new InternalServerErrorException('Failed to calculate average rating');
    }
  }
} 