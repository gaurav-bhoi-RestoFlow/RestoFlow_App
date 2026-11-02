import { useTranslation } from 'react-i18next';
import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import type { ProfilePhoto, Session } from '../restaurant/types';
import type { AuthResult, ChangePasswordInput } from '../../api/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { signedIn, signedOut } from '../../store/slices/sessionSlice';
import {
  clearCredentials,
  getCredentials,
  saveTokens,
} from '../../services/auth/credentials';
import { authApi, profileDetails, profileSession } from '../../api/restoflow';
import { registerSessionExpiredHandler } from '../../api/client';
import { normalizeApiError } from '../../api/errors';
import { EmptyState } from '../../components/EmptyState';
import { AppButton } from '../../components/AppButton';
import { hideStartupSplash } from '../../app/bootstrap';
import { useFeedback } from '../../app/FeedbackProvider';
interface SessionContextValue {
  session: Session | null;
  signIn: (result: AuthResult) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (fullName: string, photo?: ProfilePhoto) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
}
const SessionContext = createContext<SessionContextValue | null>(null);
export function SessionProvider({ children }: React.PropsWithChildren) {
  const { t } = useTranslation();
  const session = useAppSelector(state => state.session.current);
  const dispatch = useAppDispatch();
  const showFeedback = useFeedback();
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const revision = useRef(0);
  const profileRevision = useRef(0);
  const updatingProfile = useRef(false);
  useEffect(
    () =>
      registerSessionExpiredHandler(() => {
        revision.current += 1;
        dispatch(signedOut());
      }),
    [dispatch],
  );
  const signIn = useCallback(
    async (result: AuthResult) => {
      const value = profileSession(result);
      const expected = ++revision.current;
      await saveTokens(result);
      if (revision.current !== expected) return;
      dispatch(signedIn(value));
      setRestoreError('');
    },
    [dispatch],
  );
  const signOut = useCallback(async () => {
    revision.current += 1;
    try {
      if (await getCredentials()) await authApi.logout();
    } catch (error) {
      showFeedback(normalizeApiError(error).message);
    } finally {
      try {
        await clearCredentials();
      } catch {
        showFeedback(t('api.clearSessionFailed'));
      }
      dispatch(signedOut());
      setRestoreError('');
    }
  }, [dispatch, showFeedback, t]);
  const updateProfile = async (fullName: string, photo?: ProfilePhoto) => {
    if (!session) throw new Error('Please sign in again.');
    updatingProfile.current = true;
    // Invalidate earlier profile reads so they cannot restore an old photo.
    const expected = revision.current;
    const expectedProfile = ++profileRevision.current;
    try {
      const user = await authApi.updateProfile(fullName, photo);
      if (
        expected !== revision.current ||
        expectedProfile !== profileRevision.current
      )
        throw new Error('The session changed. Please sign in again.');
      if (user.id !== session.userId || (photo && !user.profileImageUrl))
        throw new Error('The backend returned an invalid profile.');
      profileRevision.current += 1;
      dispatch(
        signedIn({
          ...session,
          ...profileDetails(user),
        }),
      );
    } finally {
      updatingProfile.current = false;
    }
  };
  useEffect(() => {
    if (!session?.userId) return;
    const userId = session.userId;
    let pending: AbortController | undefined;
    let previousState = AppState.currentState;
    const listener = AppState.addEventListener('change', state => {
      const resumed = state === 'active' && previousState !== 'active';
      previousState = state;
      if (!resumed || updatingProfile.current) return;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const expected = revision.current;
      const expectedProfile = profileRevision.current;
      authApi
        .me(controller.signal)
        .then(profile => {
          if (
            controller.signal.aborted ||
            expected !== revision.current ||
            expectedProfile !== profileRevision.current ||
            profile.user.id !== userId
          )
            return;
          profileRevision.current += 1;
          dispatch(signedIn(profileSession(profile)));
        })
        .catch(() => undefined);
    });
    return () => {
      pending?.abort();
      listener.remove();
    };
  }, [dispatch, session?.userId]);
  const changePassword = async (input: ChangePasswordInput) => {
    const expected = revision.current;
    await authApi.changePassword(input);
    if (expected !== revision.current)
      throw new Error('The session changed. Please sign in again.');
    revision.current += 1;
    // The backend revokes every session as part of the password change.
    try {
      await clearCredentials();
    } catch {
      showFeedback(t('api.clearSessionFailed'));
    } finally {
      dispatch(signedOut());
      setRestoreError('');
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    const expectedRevision = revision.current;
    setLoading(true);
    setRestoreError('');
    (async () => {
      const credentials = await getCredentials();
      if (!credentials) return;
      const profile = await authApi.me(controller.signal);
      if (!controller.signal.aborted && expectedRevision === revision.current)
        dispatch(signedIn(profileSession(profile)));
    })()
      .catch(error => {
        if (!controller.signal.aborted && expectedRevision === revision.current)
          setRestoreError(normalizeApiError(error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          hideStartupSplash();
        }
      });
    return () => controller.abort();
  }, [attempt, dispatch]);
  return (
    <SessionContext.Provider
      value={{ session, signIn, signOut, updateProfile, changePassword }}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel={t('api.restoringSession')} />
        </View>
      ) : restoreError ? (
        <View style={styles.error}>
          <EmptyState
            title={t('api.restoreFailed')}
            description={restoreError}
            action={{
              label: t('api.retry'),
              onPress: () => setAttempt(value => value + 1),
            }}
          />
          <AppButton variant="secondary" onPress={signOut}>
            {t('api.signOut')}
          </AppButton>
        </View>
      ) : (
        children
      )}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession requires SessionProvider');
  return context;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center' },
  error: { flex: 1, justifyContent: 'center', padding: 24 },
});
