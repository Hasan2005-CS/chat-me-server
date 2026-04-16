import {Injectable} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {v2 as cloudinary, UploadApiResponse} from 'cloudinary';
import { buffer } from 'stream/consumers';

@Injectable()
export class UploadService {
constructor(private configService: ConfigService) {
    cloudinary.config({
        cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
        api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
        api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });

}
  async uploadFile(
    buffer: Buffer,
    folder: string,
    resourceType: 'image' | 'video' | 'raw' = 'image',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: resourceType,
          },
          (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error('Upload failed'));
            resolve(result);
          },
        )
        .end(buffer);
    });
  }

  async deleteFile(publicId: string){
    await cloudinary.uploader.destroy(publicId);
  }
}

