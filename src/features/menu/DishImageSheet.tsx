import React, { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../components/BottomSheet';
import { SheetOption } from '../../components/SheetOption';
import { AppText } from '../../components/AppText';
import { AppButton } from '../../components/AppButton';
import type { ProfilePhoto } from '../restaurant/types';
import { dishLimits } from './menuConfig';

export function DishImageSheet({
  visible,
  onSelect,
  onClose,
  canRemove,
  onRemove,
}: {
  visible: boolean;
  onSelect: (image: ProfilePhoto) => void;
  onClose: () => void;
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function select(source: 'camera' | 'gallery') {
    setError('');
    setBusy(true);
    try {
      const options = {
        mediaType: 'photo' as const,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8 as const,
      };
      const response: ImagePickerResponse = await (source === 'camera'
        ? launchCamera({ ...options, saveToPhotos: false })
        : launchImageLibrary({ ...options, selectionLimit: 1 }));
      if (response.didCancel) return;
      const asset = response.assets?.[0];
      if (response.errorCode || !asset?.uri) {
        setError(t('menu.imageUnavailable'));
        return;
      }
      if (asset.fileSize && asset.fileSize > dishLimits.imageBytes) {
        setError(t('common.chooseAnImageSmallerThan5Mb'));
        return;
      }
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(asset.type ?? '') ||
        asset.fileSize === 0
      ) {
        setError(t('menu.imageFormatRequired'));
        return;
      }
      const type = asset.type as ProfilePhoto['type'];
      onSelect({
        uri: asset.uri,
        type,
        name: `dish.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`,
      });
    } catch {
      setError(t('menu.imageUnavailable'));
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (!busy) {
      setError('');
      onClose();
    }
  }
  return (
    <BottomSheet
      visible={visible}
      title={t('menu.addDishImage')}
      onClose={close}
    >
      <SheetOption
        icon="camera"
        label={t('menu.takePhoto')}
        disabled={busy || Platform.OS === 'web'}
        onPress={() => {
          select('camera');
        }}
      />
      <SheetOption
        icon="gallery"
        label={t('menu.chooseGallery')}
        disabled={busy}
        onPress={() => {
          select('gallery');
        }}
      />
      <AppText muted variant="helper" style={styles.helper}>
        {t('menu.defaultImageStays')}
      </AppText>
      {canRemove && onRemove && (
        <SheetOption
          icon="trash"
          label={t('menu.removeSelectedPhoto')}
          disabled={busy}
          onPress={onRemove}
        />
      )}
      {!!error && (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
      )}
      <AppButton
        variant="ghost"
        disabled={busy}
        onPress={close}
        style={styles.keep}
      >
        {t('menu.keepDefaultImage')}
      </AppButton>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  helper: { marginTop: 16 },
  error: { color: '#bd3030', fontSize: 12, marginTop: 8 },
  keep: { marginTop: 18 },
});
