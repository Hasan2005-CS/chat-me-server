import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload_stream: vi.fn(),
      destroy: vi.fn(),
    },
  },
}));

import { v2 as cloudinary } from 'cloudinary';
import { UploadService } from '../upload.service';

const mockConfigService = {
  get: vi.fn().mockReturnValue('x'),
};

describe('UploadService', () => {
  let uploadService: UploadService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.get.mockReturnValue('x');
    uploadService = new UploadService(mockConfigService as any);
  });

  describe('constructor', () => {
    it('should not throw and should call cloudinary.config', () => {
      expect(cloudinary.config).toHaveBeenCalledWith({
        cloud_name: 'x',
        api_key: 'x',
        api_secret: 'x',
      });
    });
  });

  describe('uploadFile', () => {
    it('should resolve with result on success', async () => {
      const mockResult = { secure_url: 'url', public_id: 'id' };
      (cloudinary.uploader.upload_stream as any).mockImplementation(
        (options: any, callback: any) => {
          callback(null, mockResult);
          return { end: vi.fn() };
        },
      );

      const result = await uploadService.uploadFile(
        Buffer.from('x'),
        'chat-me/images',
        'image',
      );

      expect(result).toEqual(mockResult);
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        { folder: 'chat-me/images', resource_type: 'image' },
        expect.any(Function),
      );
    });

    it('should reject when callback receives an error', async () => {
      const error = new Error('boom');
      (cloudinary.uploader.upload_stream as any).mockImplementation(
        (options: any, callback: any) => {
          callback(error, null);
          return { end: vi.fn() };
        },
      );

      await expect(
        uploadService.uploadFile(Buffer.from('x'), 'chat-me/images', 'image'),
      ).rejects.toThrow('boom');
    });

    it('should reject with Upload failed when no result and no error', async () => {
      (cloudinary.uploader.upload_stream as any).mockImplementation(
        (options: any, callback: any) => {
          callback(null, null);
          return { end: vi.fn() };
        },
      );

      await expect(
        uploadService.uploadFile(Buffer.from('x'), 'chat-me/images', 'image'),
      ).rejects.toThrow('Upload failed');
    });
  });

  describe('deleteFile', () => {
    it('should call cloudinary.uploader.destroy with publicId', async () => {
      (cloudinary.uploader.destroy as any).mockResolvedValue({});

      await uploadService.deleteFile('id1');

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('id1');
    });
  });
});
