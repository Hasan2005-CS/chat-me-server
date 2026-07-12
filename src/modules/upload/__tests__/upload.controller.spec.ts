import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadController } from '../upload.controller';

const mockUploadService = {
  uploadFile: vi.fn(),
};

describe('UploadController', () => {
  let uploadController: UploadController;
  const file = { buffer: Buffer.from('x'), originalname: 'a.png' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    uploadController = new UploadController(mockUploadService as any);
  });

  describe('uploadImage', () => {
    it('should upload image and return mapped result', async () => {
      mockUploadService.uploadFile.mockResolvedValue({
        secure_url: 'u',
        public_id: 'p',
        width: 1,
        height: 1,
        format: 'png',
        bytes: 100,
      });

      const result = await uploadController.uploadImage(file);

      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        'chat-me/images',
        'image',
      );
      expect(result).toEqual({
        url: 'u',
        publicId: 'p',
        width: 1,
        height: 1,
        format: 'png',
        size: 100,
      });
    });
  });

  describe('uploadFile', () => {
    it('should upload file and return mapped result', async () => {
      mockUploadService.uploadFile.mockResolvedValue({
        secure_url: 'u',
        public_id: 'p',
        bytes: 100,
        format: 'pdf',
      });

      const result = await uploadController.uploadFile(file);

      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        'chat-me/files',
        'raw',
      );
      expect(result).toEqual({
        url: 'u',
        publicId: 'p',
        originalName: file.originalname,
        size: 100,
        format: 'pdf',
      });
    });
  });
});
