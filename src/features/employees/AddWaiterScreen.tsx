import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootScreenProps } from '../../app/navigationTypes';
import { useFeedback } from '../../app/FeedbackProvider';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { Notice } from '../../components/Notice';
import { PhotoPicker } from '../../components/PhotoPicker';
import { useProfilePhoto } from '../../hooks/useProfilePhoto';
import { colors, layout } from '../../theme/tokens';
import { normalizePhone } from '../auth/validation';
import { useWaiters } from './useWaiters';

export function AddWaiterScreen({ navigation }: RootScreenProps<'AddWaiter'>) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { photo, selectPhoto, picking } = useProfilePhoto();
  const { error, busy, addWaiter } = useWaiters();
  const showFeedback = useFeedback();
  const handleAddWaiter = async () => {
    if (picking) return;
    if (await addWaiter(name, phone, photo)) {
      navigation.goBack();
      showFeedback(
        t('employees.valueAddedToYourTeam', { value0: name.trim() }),
      );
    }
  };
  return (
    <Screen
      header={
        <AppHeader
          title={t('employees.welcomeToTheTeam')}
          subtitle={t('employees.addAWaiterToYourRestaurant')}
          onBack={navigation.goBack}
          backDisabled={busy}
        />
      }
      footer={
        <View style={layout.row}>
          <AppButton
            variant="secondary"
            onPress={navigation.goBack}
            disabled={busy}
            style={styles.cancel}
          >
            {t('employees.cancel')}
          </AppButton>
          <AppButton
            loading={busy}
            disabled={picking}
            onPress={handleAddWaiter}
            style={styles.submit}
          >
            {t('employees.addWaiter')}
          </AppButton>
        </View>
      }
    >
      <PhotoPicker
        photo={photo?.uri}
        onPress={selectPhoto}
        disabled={busy || picking}
      />
      <AppInput
        label={t('employees.waiterName')}
        value={name}
        editable={!busy}
        onChangeText={setName}
        placeholder={t('employees.eGSneha')}
        maxLength={100}
      />
      <AppInput
        label={t('employees.mobileNumber')}
        isPhone
        value={phone}
        editable={!busy}
        onChangeText={value => setPhone(normalizePhone(value))}
        placeholder={t('employees.10DigitMobileNumber')}
        returnKeyType="done"
        onSubmitEditing={handleAddWaiter}
      />
      <Notice>
        {t('employees.thisNumberGivesTheWaiterAccessToTablesAnd')}
      </Notice>
      {!!error && (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  cancel: { width: 115 },
  submit: { flex: 1 },
  error: { color: colors.error, fontSize: 12, marginTop: 12 },
});
