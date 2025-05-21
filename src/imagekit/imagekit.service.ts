import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ImageKit from 'imagekit';

@Injectable()
export class ImageKitService implements OnModuleInit {
  private imagekit: ImageKit;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const publicKey = this.configService.get<string>('IMAGEKIT_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('IMAGEKIT_PRIVATE_KEY');
    const urlEndpoint = this.configService.get<string>('IMAGEKIT_URL_ENDPOINT');

    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new Error('Missing required ImageKit configuration');
    }

    this.imagekit = new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint,
    });
  }

  async uploadImage(file: Express.Multer.File, folder: string = 'products', returnFullResult: boolean = false): Promise<any> {
    try {
      const result = await this.imagekit.upload({
        file: file.buffer,
        fileName: `${Date.now()}_${file.originalname}`,
        folder: folder,
        useUniqueFileName: true,
      });

      if (returnFullResult) {
        return { url: result.url, fileId: result.fileId };
      }
      return result.url;
    } catch (error) {
      console.error('Error uploading to ImageKit:', error);
      throw new Error('Failed to upload image');
    }
  }

  async deleteImage(fileName: string): Promise<void> {
    try {
      // First, list files to find the fileId
      const files = await this.imagekit.listFiles({
        path: 'profile-photos',
        name: fileName,
      });

      if (!files || files.length === 0) {
        throw new Error('File not found in ImageKit');
      }

      // Get the fileId from the first matching file
      const file = files[0];
      if (!file || !('fileId' in file)) {
        throw new Error('File ID not found');
      }

      // Delete the file using the fileId
      await this.imagekit.deleteFile(file.fileId);
    } catch (error) {
      console.error('Error deleting from ImageKit:', error);
      throw new Error('Failed to delete image');
    }
  }

  getImageUrl(path: string, transformations?: any): string {
    return this.imagekit.url({
      path: path,
      transformation: transformations,
    });
  }
} 