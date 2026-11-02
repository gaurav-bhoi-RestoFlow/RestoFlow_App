import { NativeModules } from 'react-native';
import type { ProfilePhoto } from '../features/restaurant/types';

export const PROFILE_PHOTO_SIZE = 256;
export const PROFILE_PHOTO_MAX_BYTES = 64 * 1024;

interface PreparedPhoto extends ProfilePhoto {
  width: number;
  height: number;
  fileSize: number;
}
interface ProfilePhotoModule {
  prepare(uri: string): Promise<PreparedPhoto>;
  remove(uri: string): Promise<void>;
}
const native = NativeModules.ProfilePhoto as ProfilePhotoModule | undefined;

export async function prepareProfilePhoto(uri: string): Promise<ProfilePhoto> {
  if (!native) throw new Error('Profile photo processing is unavailable.');
  const photo = await native.prepare(uri);
  if (
    !photo.uri?.startsWith('file://') ||
    photo.type !== 'image/jpeg' ||
    photo.width !== PROFILE_PHOTO_SIZE ||
    photo.height !== PROFILE_PHOTO_SIZE ||
    !Number.isFinite(photo.fileSize) ||
    photo.fileSize <= 0 ||
    photo.fileSize > PROFILE_PHOTO_MAX_BYTES
  ) {
    if (photo.uri) await removeProfilePhoto(photo.uri);
    throw new Error('The photo could not be prepared.');
  }
  return { uri: photo.uri, type: 'image/jpeg', name: 'profile.jpg' };
}

export async function removeProfilePhoto(uri: string) {
  await native?.remove(uri).catch(() => undefined);
}
