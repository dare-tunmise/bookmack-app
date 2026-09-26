import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

// The API asks for about 1568px on the long edge: bigger photos cost more to read and aren't
// read any better, and the upload limit is 3.5MB.
const MAX_LONG_EDGE = 1568;
const JPEG_QUALITY = 0.8;

// Route params can't carry file URIs: expo-router decodes param values twice, which breaks paths
// containing percent signs (Expo Go keeps camera photos under such a folder). The scan screen
// leaves the photo here for the cover scan screen instead.
let pendingPhotoUri: string | null = null;

export const setPendingCoverPhoto = (uri: string) => {
  pendingPhotoUri = uri;
};

export const pendingCoverPhoto = () => pendingPhotoUri;

// Shrinks a camera photo for upload and returns the JPEG as base64, kept in memory.
export async function coverPhotoJpegBase64(uri: string): Promise<string> {
  const images: ImageRef[] = [];
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    images.push(original);

    let upload = original;
    if (Math.max(original.width, original.height) > MAX_LONG_EDGE) {
      const size = original.width >= original.height ? { width: MAX_LONG_EDGE } : { height: MAX_LONG_EDGE };
      upload = await ImageManipulator.manipulate(original).resize(size).renderAsync();
      images.push(upload);
    }

    const { base64 } = await upload.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
    if (!base64) throw new Error('The image manipulator returned no base64 data');
    return base64;
  } finally {
    for (const image of images) image.release();
  }
}
