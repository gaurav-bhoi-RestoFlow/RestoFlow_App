import React, { useRef, useState } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootScreenProps } from '../../app/navigationTypes';
import { useFeedback } from '../../app/FeedbackProvider';
import { normalizeApiError } from '../../api/errors';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { AppText } from '../../components/AppText';
import { PhotoPicker } from '../../components/PhotoPicker';
import { Screen } from '../../components/Screen';
import { useProfilePhoto } from '../../hooks/useProfilePhoto';
import { colors, contentWidths } from '../../theme/tokens';
import { useSession } from '../auth/SessionProvider';

export function EditProfileScreen({
  navigation,
}: RootScreenProps<'EditProfile'>) {
  const { t } = useTranslation();
  const { session, updateProfile } = useSession();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  // Untouched fields follow a refreshed profile; preserve edits in progress.
  const name = nameDraft ?? session?.name ?? '';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const { photo, selectPhoto, picking } = useProfilePhoto();
  const showFeedback = useFeedback();
  const hasChanges = !!photo || name.trim() !== session?.name;
  const handleSave = async () => {
    if (inFlight.current || picking || !hasChanges) return;
    if (name.trim().length < 2 || name.trim().length > 100) {
      setError(t('settings.nameLength'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await updateProfile(name, photo);
      Keyboard.dismiss();
      showFeedback(t('settings.profileUpdated'));
      navigation.goBack();
    } catch (cause) {
      setError(normalizeApiError(cause).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen
      contentMaxWidth={contentWidths.form}
      header={
        <AppHeader
          maxWidth={contentWidths.form}
          title={t('settings.editProfile')}
          subtitle={t('settings.editProfileSubtitle')}
          onBack={navigation.goBack}
          backDisabled={busy}
        />
      }
      footer={
        <AppButton
          loading={busy}
          disabled={picking || !hasChanges}
          onPress={handleSave}
        >
          {t('settings.saveProfile')}
        </AppButton>
      }
    >
      <PhotoPicker
        name={name}
        photo={photo?.uri ?? session?.photo}
        label={t('settings.changePhoto')}
        disabled={busy || picking}
        onPress={selectPhoto}
      />
      <AppInput
        label={t('auth.yourName')}
        value={name}
        editable={!busy}
        onChangeText={value => {
          setNameDraft(value);
          setError('');
        }}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
      {!!error && (
        <AppText
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 12, color: colors.error, marginTop: 12 },
});
