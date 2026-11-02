import { useTranslation } from 'react-i18next';
import React, { useRef, useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  View,
  type TextInputInstance,
} from 'react-native';
import type { RootScreenProps } from '../../app/navigationTypes';
import { useFeedback } from '../../app/FeedbackProvider';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { Notice } from '../../components/Notice';
import { PhotoPicker } from '../../components/PhotoPicker';
import { Screen } from '../../components/Screen';
import { useProfilePhoto } from '../../hooks/useProfilePhoto';
import { colors, contentWidths } from '../../theme/tokens';
import { useAuth } from './useAuth';
import { isValidPassword, isValidPhone, normalizePhone } from './validation';
import { normalizeApiError } from '../../api/errors';

export function RegistrationScreen({
  route,
  navigation,
}: RootScreenProps<'Registration'>) {
  const { t } = useTranslation();
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState(route.params.phone);
  const [error, setError] = useState('');
  const { photo, selectPhoto, picking } = useProfilePhoto();
  const { register } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const showFeedback = useFeedback();
  const ownerInput = useRef<TextInputInstance>(null);
  const phoneInput = useRef<TextInputInstance>(null);
  const passwordInput = useRef<TextInputInstance>(null);
  const confirmPasswordInput = useRef<TextInputInstance>(null);
  const handleRegister = async () => {
    if (inFlight.current || picking) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      if (
        restaurantName.trim().length < 2 ||
        restaurantName.trim().length > 150 ||
        ownerName.trim().length < 2 ||
        ownerName.trim().length > 100
      )
        throw new Error(t('auth.enterNames'));
      if (!isValidPhone(phone))
        throw new Error(t('auth.enterAValid10DigitIndianMobileNumber'));
      if (!isValidPassword(password)) throw new Error(t('auth.passwordLength'));
      if (password !== confirmPassword)
        throw new Error(t('auth.passwordsDoNotMatch'));
      await register(
        {
          phoneNumber: phone,
          password,
          confirmPassword,
          fullName: ownerName,
          restaurantName,
        },
        photo,
      );
      Keyboard.dismiss();
      showFeedback(t('auth.yourRestaurantIsReadyAddYourFirstTable'));
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
          title={t('auth.welcomeAboard')}
          subtitle={t('auth.aFewDetailsThenYouReReady')}
          onBack={navigation.goBack}
          backDisabled={busy}
        />
      }
      footer={
        <View style={styles.actions}>
          <AppButton
            variant="secondary"
            onPress={navigation.goBack}
            disabled={busy}
            style={styles.cancel}
          >
            {t('auth.cancel')}
          </AppButton>
          <AppButton
            onPress={handleRegister}
            loading={busy}
            disabled={picking}
            style={styles.submit}
          >
            {t('auth.createAccount')}
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
        label={t('auth.restaurantName')}
        value={restaurantName}
        editable={!busy}
        onChangeText={value => {
          setRestaurantName(value);
          setError('');
        }}
        autoCapitalize="words"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => ownerInput.current?.focus()}
        placeholder={t('auth.eGSaffronKitchen')}
      />
      <AppInput
        ref={ownerInput}
        label={t('auth.yourName')}
        value={ownerName}
        editable={!busy}
        onChangeText={value => {
          setOwnerName(value);
          setError('');
        }}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneInput.current?.focus()}
        placeholder={t('auth.restaurantOwner')}
      />
      <AppInput
        ref={phoneInput}
        label={t('auth.mobileNumber')}
        isPhone
        editable={!busy}
        value={phone}
        onChangeText={value => {
          setPhone(normalizePhone(value));
          setError('');
        }}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordInput.current?.focus()}
      />
      <AppInput
        ref={passwordInput}
        label={t('auth.password')}
        placeholder={t('auth.createPassword')}
        value={password}
        onChangeText={value => {
          setPassword(value);
          setError('');
        }}
        editable={!busy}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmPasswordInput.current?.focus()}
      />
      <AppInput
        ref={confirmPasswordInput}
        label={t('auth.confirmPassword')}
        placeholder={t('auth.reenterPassword')}
        value={confirmPassword}
        onChangeText={value => {
          setConfirmPassword(value);
          setError('');
        }}
        editable={!busy}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleRegister}
      />
      <Notice assetIcon="leaf">{t('api.trialNotice')}</Notice>
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancel: { width: 115 },
  submit: { flex: 1 },
  error: { fontSize: 12, color: colors.error, marginTop: 12 },
});
