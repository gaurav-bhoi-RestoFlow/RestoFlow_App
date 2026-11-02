import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFeedback } from '../app/FeedbackProvider';
import type { ProfilePhoto } from '../features/restaurant/types';
import {
  prepareProfilePhoto,
  removeProfilePhoto,
} from '../services/profilePhoto';
export function useProfilePhoto() {
  const { t } = useTranslation();
  const [photo, setPhoto] = useState<ProfilePhoto>();
  const [picking, setPicking] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const draft = useRef<ProfilePhoto | undefined>(undefined);
  const showFeedback = useFeedback();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (draft.current) removeProfilePhoto(draft.current.uri);
    };
  }, []);
  const selectPhoto = async () => {
    if (pending.current) return;
    pending.current = true;
    setPicking(true);
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        assetRepresentationMode: 'current',
        includeBase64: false,
        includeExtra: false,
      });
      if (response.didCancel || !mounted.current) return;
      const asset = response.assets?.[0];
      if (response.errorCode || !asset?.uri) {
        showFeedback(t('common.thePhotoCouldNotBeOpenedTryAnotherPhoto'));
        return;
      }
      // Decode the actual image, rather than trusting picker MIME aliases or
      // rejecting a large original that will become a tiny JPEG.
      const prepared = await prepareProfilePhoto(asset.uri);
      if (!mounted.current) {
        await removeProfilePhoto(prepared.uri);
        return;
      }
      const previous = draft.current;
      draft.current = prepared;
      setPhoto(prepared);
      if (previous) await removeProfilePhoto(previous.uri);
    } catch {
      if (mounted.current)
        showFeedback(t('common.thePhotoCouldNotBeOpenedTryAnotherPhoto'));
    } finally {
      pending.current = false;
      if (mounted.current) setPicking(false);
    }
  };
  return { photo, selectPhoto, picking };
}
