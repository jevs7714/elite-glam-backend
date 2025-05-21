import { Injectable, BadRequestException, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { UserRecord, CreateUserInput, AuthResponse } from './database.types';
import { Timestamp } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import { Multer } from 'multer';

interface FirebaseError extends Error {
  code?: string;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: admin.app.App;
  private db: admin.firestore.Firestore;
  private auth: admin.auth.Auth;
  private storage: admin.storage.Storage;

  constructor(public readonly configService: ConfigService) {
    console.log('Initializing Firebase Service...'); // Debug log
  }

  onModuleInit() {
    try {
      console.log('Running onModuleInit...'); // Debug log
      
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const storageBucket = this.configService.get<string>('FIREBASE_STORAGE_BUCKET');
      const databaseURL = this.configService.get<string>('FIREBASE_DATABASE_URL');

      // Enhanced debugging
      console.log('Firebase Configuration Check:');
      console.log('- Project ID:', projectId ? 'Present' : 'Missing');
      console.log('- Client Email:', clientEmail ? 'Present' : 'Missing');
      console.log('- Private Key:', privateKey ? 'Present' : 'Missing');
      console.log('- Storage Bucket:', storageBucket ? 'Present' : 'Missing');
      console.log('- Database URL:', databaseURL ? 'Present' : 'Missing');

      if (!privateKey || !projectId || !clientEmail) {
        console.error('Missing required Firebase configuration:');
        if (!privateKey) console.error('- FIREBASE_PRIVATE_KEY is missing');
        if (!projectId) console.error('- FIREBASE_PROJECT_ID is missing');
        if (!clientEmail) console.error('- FIREBASE_CLIENT_EMAIL is missing');
        throw new Error('Missing required Firebase configuration');
      }

      // Initialize Firebase Admin only if not already initialized
      if (!admin.apps.length) {
        console.log('Initializing new Firebase app...'); // Debug log
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
          storageBucket,
          databaseURL,
        });
        console.log('Firebase app initialized successfully');
      } else {
        console.log('Using existing Firebase app');
        this.firebaseApp = admin.app();
      }

      this.db = this.firebaseApp.firestore();
      this.auth = this.firebaseApp.auth();
      this.storage = this.firebaseApp.storage();
      
      console.log('Firebase initialization complete'); // Debug log
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      throw error;
    }
  }

  getAuth(): admin.auth.Auth {
    return this.auth;
  }

  // Database operations
  async getCollection(collection: string): Promise<admin.firestore.CollectionReference> {
    return this.db.collection(collection);
  }

  async getDocument(collection: string, id: string): Promise<admin.firestore.DocumentReference> {
    return this.db.collection(collection).doc(id);
  }

  async addDocument(collection: string, data: any): Promise<void> {
    const docRef = this.db.collection(collection).doc(data.id);
    await docRef.set({
      ...data,
      createdAt: Timestamp.fromDate(data.createdAt),
      updatedAt: Timestamp.fromDate(data.updatedAt),
    });
  }

  async updateDocument(collection: string, id: string, data: any): Promise<void> {
    const docRef = this.db.collection(collection).doc(id);
    await docRef.update({
      ...data,
      updatedAt: Timestamp.fromDate(data.updatedAt),
    });
  }

  async verifyPassword(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('Starting password verification for email:', email);

      // Get user by email using Admin SDK
      const userRecord = await this.auth.getUserByEmail(email);
      if (!userRecord) {
        console.error('User not found with email:', email);
        throw new UnauthorizedException('Invalid credentials');
      }

      console.log('Found user with UID:', userRecord.uid);

      // Verify password using Firebase Auth REST API
      const apiKey = this.configService.get<string>('FIREBASE_API_KEY');
      const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
      
      const response = await fetch(signInUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      });

      const data = await response.json();
      
      if (!response.ok || data.error) {
        console.error('Password verification failed:', data.error);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Get user data from Firestore
      const userDoc = await this.db.collection('users').doc(userRecord.uid).get();
      if (!userDoc.exists) {
        console.error('User document not found in Firestore');
        throw new UnauthorizedException('Invalid credentials');
      }

      const userData = userDoc.data() as UserRecord;
      if (!userData) {
        console.error('Invalid user data in Firestore');
        throw new UnauthorizedException('Invalid credentials');
      }

      // Create a custom token for the user
      const customToken = await this.auth.createCustomToken(userRecord.uid);
      console.log('Created custom token for user:', userRecord.uid);

      return {
        ...userData,
        customToken
      };
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  // User Collection Methods
  async createUserRecord(userData: CreateUserInput): Promise<UserRecord> {
    try {
      console.log('Creating user with data:', {
        email: userData.email,
        username: userData.username,
      });

      // Create auth user with Admin SDK
      const authUser = await this.auth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.username,
      });

      console.log('Auth user created:', authUser.uid);

      // Create user record in Firestore
      const userRecord: UserRecord = {
        uid: authUser.uid,
        username: userData.username,
        email: userData.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to Firestore
      await this.db.collection('users').doc(authUser.uid).set(userRecord);
      console.log('User record created in Firestore');

      return userRecord;
    } catch (error) {
      console.error('Error creating user:', error);
      
      const firebaseError = error as FirebaseError;
      if (firebaseError.code === 'auth/email-already-exists') {
        throw new BadRequestException('Email already exists');
      }
      if (firebaseError.code === 'auth/invalid-email') {
        throw new BadRequestException('Invalid email format');
      }
      if (firebaseError.code === 'auth/weak-password') {
        throw new BadRequestException('Password is too weak');
      }
      
      throw new BadRequestException(firebaseError.message || 'Failed to create user');
    }
  }

  async getUserByUid(uid: string): Promise<UserRecord | null> {
    try {
      const userDoc = await this.db.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        return null;
      }

      return userDoc.data() as UserRecord;
    } catch (error) {
      const firebaseError = error as FirebaseError;
      throw new Error(`Error getting user: ${firebaseError.message || 'Unknown error'}`);
    }
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    try {
      const userRecord = await this.auth.getUserByEmail(email);
      const userDoc = await this.db.collection('users').doc(userRecord.uid).get();
      
      if (!userDoc.exists) {
        return null;
      }

      return userDoc.data() as UserRecord;
    } catch (error) {
      const firebaseError = error as FirebaseError;
      if (firebaseError.code === 'auth/user-not-found') {
        return null;
      }
      throw error;
    }
  }

  async updateUser(uid: string, updateData: Partial<UserRecord>): Promise<UserRecord> {
    const userRef = this.db.collection('users').doc(uid);
    
    await userRef.update({
      ...updateData,
      updatedAt: new Date()
    });

    const updatedDoc = await userRef.get();
    return updatedDoc.data() as UserRecord;
  }

  async create<T extends Record<string, any>>(collection: string, data: T): Promise<string> {
    try {
      console.log(`Attempting to create document in collection '${collection}' with data:`, data);
      
      if (!this.db) {
        throw new Error('Firestore is not initialized');
      }

      const docRef = await this.db.collection(collection).add({
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      console.log(`Document created successfully in collection '${collection}' with ID:`, docRef.id);
      return docRef.id;
    } catch (error) {
      console.error(`Error creating document in collection '${collection}':`, error);
      throw error;
    }
  }

  async update<T extends Record<string, any>>(collection: string, id: string, data: Partial<T>): Promise<void> {
    await this.db.collection(collection).doc(id).update({
      ...data,
      updatedAt: Timestamp.now(),
    });
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.db.collection(collection).doc(id).delete();
  }

  async findById<T>(collection: string, id: string): Promise<T | null> {
    const doc = await this.db.collection(collection).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as T;
  }

  async findAll<T>(collection: string): Promise<T[]> {
    const snapshot = await this.db.collection(collection).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);
  }

  // Add method to verify Firebase tokens
  async verifyToken(token: string): Promise<admin.auth.DecodedIdToken> {
    try {
      console.log('Starting token verification...');
      
      try {
        // First try to verify as an ID token
        console.log('Attempting to verify as ID token...');
        const decodedToken = await this.auth.verifyIdToken(token);
        console.log('Successfully verified as ID token:', {
          uid: decodedToken.uid,
          email: decodedToken.email
        });
        return decodedToken;
      } catch (idTokenError) {
        console.log('ID token verification failed:', idTokenError.message);
        
        try {
          // Try to get the user from the token claims
          console.log('Attempting to decode token claims...');
          const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          console.log('Decoded token claims:', decoded);

          if (decoded.uid) {
            // Verify the user exists
            const user = await this.auth.getUser(decoded.uid);
            console.log('Found user from token claims:', user.uid);
            
            return {
              uid: user.uid,
              email: user.email,
              iat: decoded.iat,
              exp: decoded.exp,
              aud: this.configService.get('FIREBASE_PROJECT_ID'),
              iss: `https://securetoken.google.com/${this.configService.get('FIREBASE_PROJECT_ID')}`,
              sub: user.uid
            } as admin.auth.DecodedIdToken;
          }
          throw new Error('Invalid token claims');
        } catch (claimsError) {
          console.error('Token claims verification failed:', claimsError);
          throw new UnauthorizedException('Invalid token');
        }
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async createCustomToken(uid: string): Promise<string> {
    try {
      return await this.auth.createCustomToken(uid);
    } catch (error) {
      console.error('Error creating custom token:', error);
      throw new BadRequestException('Failed to create authentication token');
    }
  }

  async uploadImage(file: Express.Multer.File, userId: string): Promise<string> {
    try {
      const bucket = this.storage.bucket();
      const fileName = `products/${userId}/${Date.now()}_${file.originalname}`;
      const fileUpload = bucket.file(fileName);

      const stream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          console.error('Error uploading file:', error);
          reject(error);
        });

        stream.on('finish', async () => {
          // Make the file publicly accessible
          await fileUpload.makePublic();
          
          // Get the public URL
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
          resolve(publicUrl);
        });

        stream.end(file.buffer);
      });
    } catch (error) {
      console.error('Error in uploadImage:', error);
      throw new Error('Failed to upload image');
    }
  }

  async updateUserProfile(userId: string, profileData: { 
    photoURL?: string; 
    firstName?: string; 
    lastName?: string; 
    bio?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      phoneNumber?: string;
    };
  }): Promise<void> {
    try {
      // Get the current user document
      const userRef = this.db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const currentProfile = userData?.profile || {};

      // Create update object with only the fields that are provided
      const updateData: any = {
        updatedAt: new Date(),
      };

      // Only include fields that are provided in the update
      if (profileData.photoURL !== undefined) {
        updateData['profile.photoURL'] = profileData.photoURL;
      }
      if (profileData.bio !== undefined) {
        updateData['profile.bio'] = profileData.bio;
      }
      if (profileData.firstName !== undefined) {
        updateData['profile.firstName'] = profileData.firstName;
      }
      if (profileData.lastName !== undefined) {
        updateData['profile.lastName'] = profileData.lastName;
      }
      if (profileData.address !== undefined) {
        updateData['profile.address'] = profileData.address;
      }

      // Update Firestore profile
      await userRef.update(updateData);

      // Update auth profile if photoURL is provided
      if (profileData.photoURL) {
        await this.auth.updateUser(userId, {
          photoURL: profileData.photoURL,
        });
      }

      console.log('Profile updated successfully:', updateData);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }
} 