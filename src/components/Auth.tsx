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
    <I18n.div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Glows */}
      <I18n.div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />
      <I18n.div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-lime-500/5 blur-[120px] rounded-full" />

      {/* Language Selector Top Right */}
      <I18n.div className="absolute top-6 right-6 z-50">
        <LanguageSelector />
      </I18n.div>

      <I18n.div className="w-full max-w-md relative z-10 pt-12">
        {/* Prominent back pill */}
        <I18n.button
          onClick={() => navigate('/landing')}
          className="absolute top-6 left-6 flex items-center gap-3 text-sm uppercase font-bold tracking-widest text-text-dim hover:text-accent transition-colors bg-white/3 hover:bg-white/5 px-3 py-2 rounded-full shadow-md backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('backToLanding')}
        </I18n.button>

        <I18n.div className="text-center mb-6">
          <I18n.div className="flex justify-center mb-2">
            <motion.img
              src={brand.icon}
              alt={brand.name + ' Logo'}
              className="w-20 h-20 object-contain drop-shadow-[0_0_14px_rgba(124,255,26,0.35)]"
              referrerPolicy="no-referrer"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 200 }}
            />
          </I18n.div>
          <I18n.h1 className="text-3xl font-black tracking-tighter uppercase">{brand.name}</I18n.h1>
          <I18n.p className="text-[10px] text-text-dim uppercase tracking-widest mt-2 font-bold">
            {t('brandTagline')}
          </I18n.p>
        </I18n.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bento-card !bg-white/5 border-white/10 backdrop-blur-xl"
        >
          <I18n.h2 className="text-xs font-black uppercase mb-8 border-b border-white/5 pb-4 tracking-widest">
            {isLogin ? t('systemAccess') : t('createAccount')}
          </I18n.h2>

          {destination !== '/' && (
            <I18n.p className="mb-6 text-sm leading-6 text-text-dim" role="status">
              {t('signInForSection')}
            </I18n.p>
          )}

          {error && (
            <I18n.div className="bg-loss/10 border border-loss/50 p-4 mb-8 text-[10px] text-loss uppercase font-black rounded-xl animate-shake">
              {t('errorLabel')}: {error}
            </I18n.div>
          )}

          <I18n.form onSubmit={handleSubmit} className="space-y-6">
            <I18n.div>
              <I18n.label className="block text-[10px] uppercase text-text-dim mb-2 font-bold tracking-widest">
                {t('emailLabel')}
              </I18n.label>
              <I18n.input
                type="email"
                aria-label="Email address"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs focus:outline-none focus:border-accent transition-all font-bold"
                placeholder="name@company.com"
                required
              />
            </I18n.div>
            <I18n.div>
              <I18n.label className="block text-[10px] uppercase text-text-dim mb-2 font-bold tracking-widest">
                {t('passwordLabel')}
              </I18n.label>
              <I18n.input
                type="password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs focus:outline-none focus:border-accent transition-all font-bold"
                placeholder="••••••••"
                minLength={isLogin ? 1 : 8}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
            </I18n.div>

            <I18n.button
              type="submit"
              disabled={authLoading}
              className="w-full bg-gradient-to-r from-accent to-lime-500 text-bg py-4 rounded-xl text-sm uppercase font-black tracking-widest hover:scale-[1.01] active:scale-95 transition-all shadow-[0_14px_30px_-10px_rgba(124,255,26,0.28)]"
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

          <I18n.div className="relative my-10">
            <I18n.div className="absolute inset-0 flex items-center">
              <I18n.div className="w-full border-t border-white/5"></I18n.div>
            </I18n.div>
            <I18n.div className="relative flex justify-center text-[9px] uppercase font-bold tracking-widest">
              <I18n.span className="bg-[#0A0A0A] px-4 text-text-dim">
                {t('orContinueWith')}
              </I18n.span>
            </I18n.div>
          </I18n.div>

          <I18n.button
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-3 bg-[#0b0b0b] border border-white/6 py-4 rounded-xl text-sm uppercase font-black tracking-widest hover:scale-105 transition-transform shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
          >
            <I18n.img
              src="https://www.google.com/favicon.ico"
              className="w-5 h-5"
              alt="Google"
              referrerPolicy="no-referrer"
            />
            <I18n.span className="ml-2">
              {authLoading ? t('sending') : t('googleAccount')}
            </I18n.span>
          </I18n.button>

          <I18n.p className="mt-10 text-center text-[10px] text-text-dim uppercase font-bold tracking-widest">
            {isLogin ? t('noAccount') : t('haveAccount')}
            <I18n.button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-accent font-black hover:underline"
            >
              {isLogin ? t('registerNow') : t('signInNow')}
            </I18n.button>
          </I18n.p>
        </motion.div>

        <I18n.div className="mt-12 flex items-center justify-center gap-2 opacity-20">
          <ShieldCheck className="w-4 h-4" />
          <I18n.span className="text-[8px] uppercase tracking-widest font-bold">
            {t('authSecurityActive')}
          </I18n.span>
        </I18n.div>
      </I18n.div>
    </I18n.div>
  );
}
