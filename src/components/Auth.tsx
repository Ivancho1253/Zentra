import { I18n } from './Localized';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { brand } from '../../shared/brand';
import { useLanguage } from '../contexts/LanguageContext';
import { trackEvent } from '../lib/analytics';
import { postLoginPath } from '../lib/authNavigation';
import { errorCode, errorMessage } from '../lib/errors';
import { auth } from '../lib/firebase';
import LanguageSelector from './LanguageSelector';
import BrandMark from './BrandMark';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const destination = postLoginPath(location.state);
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const getAuthErrorMessage = (err: unknown) => {
    const code = errorCode(err);
    if (code === 'auth/unauthorized-domain') {
      return `This domain is not authorized in Firebase Auth. Add "${window.location.hostname}" in Firebase Console > Authentication > Settings > Authorized domains.`;
    }
    if (code === 'auth/operation-not-allowed') {
      return 'This sign-in provider is disabled. Enable Google and/or Email/Password in Firebase Console > Authentication > Sign-in method.';
    }
    if (code === 'auth/popup-blocked') {
      return 'The browser blocked the Google sign-in popup. Allow popups for localhost and try again.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'The Google sign-in window closed before completing login. Try again and finish the Google prompt.';
    }
    if (code === 'auth/cancelled-popup-request') {
      return 'A Google sign-in popup was already open. Close the extra popups and try once.';
    }
    return errorMessage(err);
  };

  React.useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          trackEvent('auth_google_redirect_success');
          navigate(destination, { replace: true });
        }
      })
      .catch((err: unknown) => {
        trackEvent('auth_google_redirect_failed', { code: errorCode(err) });
        setError(getAuthErrorMessage(err));
      });
  }, [navigate, destination]);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) navigate(destination, { replace: true });
    });
    return () => unsubscribe();
  }, [navigate, destination]);

  const handleGoogleSignIn = async () => {
    if (authLoading) return;
    setAuthLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        trackEvent('auth_google_popup_success');
        navigate(destination, { replace: true });
      }
    } catch (err: unknown) {
      const code = errorCode(err);
      trackEvent('auth_google_popup_failed', { code });
      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          trackEvent('auth_google_redirect_started');
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: unknown) {
          trackEvent('auth_google_redirect_failed', { code: errorCode(redirectErr) });
          setError(getAuthErrorMessage(redirectErr));
        }
      } else {
        setError(getAuthErrorMessage(err));
      }
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        trackEvent('auth_email_login_success');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        trackEvent('auth_email_register_success');
      }
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      trackEvent(isLogin ? 'auth_email_login_failed' : 'auth_email_register_failed', {
        code: errorCode(err),
      });
      setError(getAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <I18n.div className="min-h-screen bg-bg flex items-center justify-center px-4 py-20 font-sans relative">
      {/* Language Selector Top Right */}
      <I18n.div className="absolute top-6 right-6 z-50">
        <LanguageSelector />
      </I18n.div>

      <I18n.div className="w-full max-w-[400px] relative z-10">
        <I18n.button
          onClick={() => navigate('/landing')}
          className="mb-8 flex items-center gap-2 text-xs text-text-dim hover:text-text-main transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToLanding')}
        </I18n.button>

        <I18n.div className="text-center mb-7">
          <I18n.div className="flex items-center justify-center gap-2.5">
            <BrandMark className="h-8 w-8 text-accent" />
            <I18n.h1 className="text-2xl font-semibold tracking-tight">{brand.name}</I18n.h1>
          </I18n.div>
          <I18n.p className="text-xs text-text-dim mt-2">{t('brandTagline')}</I18n.p>
        </I18n.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-lg border border-border-accent bg-surface p-6 sm:p-7"
        >
          <I18n.h2 className="text-lg font-semibold mb-6">
            {isLogin ? t('systemAccess') : t('createAccount')}
          </I18n.h2>

          {destination !== '/' && (
            <I18n.p className="mb-6 text-sm leading-6 text-text-dim" role="status">
              {t('signInForSection')}
            </I18n.p>
          )}

          {error && (
            <I18n.div className="bg-loss/5 border border-loss/25 p-3 mb-5 text-xs leading-5 text-loss rounded-md">
              {t('errorLabel')}: {error}
            </I18n.div>
          )}

          <I18n.form onSubmit={handleSubmit} className="space-y-5">
            <I18n.div>
              <I18n.label className="block text-xs text-text-dim mb-2 font-medium">
                {t('emailLabel')}
              </I18n.label>
              <I18n.input
                type="email"
                aria-label="Email address"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="terminal-input w-full !py-3 focus:outline-none focus:border-accent"
                placeholder="name@company.com"
                required
              />
            </I18n.div>
            <I18n.div>
              <I18n.label className="block text-xs text-text-dim mb-2 font-medium">
                {t('passwordLabel')}
              </I18n.label>
              <I18n.input
                type="password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="terminal-input w-full !py-3 focus:outline-none focus:border-accent"
                placeholder="••••••••"
                minLength={isLogin ? 1 : 8}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
            </I18n.div>

            <I18n.button
              type="submit"
              disabled={authLoading}
              className="primary-button w-full !py-3 hover:brightness-105 transition-colors"
            >
              {authLoading ? t('sending') : isLogin ? t('signIn') : t('register')}
            </I18n.button>
          </I18n.form>
          {isLogin && (
            <I18n.button
              type="button"
              className="mt-4 text-xs text-accent"
              disabled={authLoading}
              onClick={async () => {
                if (!email.trim()) {
                  setError('Enter your email address first.');
                  return;
                }
                setAuthLoading(true);
                try {
                  await sendPasswordResetEmail(auth, email.trim());
                  setError('If this account exists, a password reset email has been sent.');
                } catch {
                  setError('Could not request a password reset. Please try again.');
                } finally {
                  setAuthLoading(false);
                }
              }}
            >
              Forgot password?
            </I18n.button>
          )}

          <I18n.div className="relative my-6">
            <I18n.div className="absolute inset-0 flex items-center">
              <I18n.div className="w-full border-t border-border-accent"></I18n.div>
            </I18n.div>
            <I18n.div className="relative flex justify-center text-xs">
              <I18n.span className="bg-surface px-3 text-text-dim">{t('orContinueWith')}</I18n.span>
            </I18n.div>
          </I18n.div>

          <I18n.button
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="secondary-button w-full !py-3 hover:border-text-dim transition-colors"
          >
            <I18n.img
              src="https://www.google.com/favicon.ico"
              className="w-5 h-5"
              alt="Google"
              referrerPolicy="no-referrer"
            />
            <I18n.span>{authLoading ? t('sending') : t('googleAccount')}</I18n.span>
          </I18n.button>

          <I18n.p className="mt-6 text-center text-xs text-text-dim leading-6">
            {isLogin ? t('noAccount') : t('haveAccount')}
            <I18n.button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-1 text-accent font-medium hover:underline"
            >
              {isLogin ? t('registerNow') : t('signInNow')}
            </I18n.button>
          </I18n.p>
        </motion.div>

        <I18n.div className="mt-6 flex items-center justify-center gap-2 text-text-dim">
          <ShieldCheck className="w-4 h-4" />
          <I18n.span className="text-[10px]">{t('authSecurityActive')}</I18n.span>
        </I18n.div>
      </I18n.div>
    </I18n.div>
  );
}
