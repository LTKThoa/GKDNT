import type { ImagePickerAsset } from 'expo-image-picker';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: { message?: string };
};

export async function uploadProductImage(asset: ImagePickerAsset): Promise<string> {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Thiếu cấu hình Cloudinary trong file .env.');
  }

  const formData = new FormData();

  if (Platform.OS === 'web') {
    if (!asset.file) {
      throw new Error('Trình duyệt không cung cấp tệp ảnh. Hãy chọn lại ảnh rồi thử lưu.');
    }
    formData.append('file', asset.file);
  } else {
    formData.append('file', new File(asset.uri), asset.fileName ?? 'product-image.jpg');
  }

  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const result = (await response.json()) as CloudinaryUploadResponse;

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message ?? 'Không tải được ảnh lên Cloudinary.');
  }

  return result.secure_url;
}
