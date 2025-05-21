import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [ImageKitModule, FirebaseModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {} 