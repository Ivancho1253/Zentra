import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from './LanguageSelector';
import { trackEvent } from '../lib/analytics';

export default function Auth() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    getRedirectResult(auth).catch((err: any) => {
      setError(err.message);
    });
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      trackEvent('auth_google_success');
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        const provider = new GoogleAuthProvider();
        trackEvent('auth_google_redirect');
        await signInWithRedirect(auth, provider);
        return;
      }
      trackEvent('auth_google_failed', { code: err.code || 'unknown' });
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        trackEvent('auth_email_login_success');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        trackEvent('auth_email_register_success');
      }
    } catch (err: any) {
      trackEvent(isLogin ? 'auth_email_login_failed' : 'auth_email_register_failed', { code: err.code || 'unknown' });
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-lime-500/5 blur-[120px] rounded-full" />

      {/* Language Selector Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <LanguageSelector />
      </div>

  <div className="w-full max-w-md relative z-10 pt-12">
        {/* Prominent back pill */}
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 flex items-center gap-3 text-sm uppercase font-bold tracking-widest text-text-dim hover:text-accent transition-colors bg-white/3 hover:bg-white/5 px-3 py-2 rounded-full shadow-md backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('backToLanding')}
        </button>

        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <motion.img 
              src="/logo.png" 
              alt="ZENTRA Logo" 
              className="w-20 h-20 object-contain drop-shadow-[0_0_14px_rgba(124,255,26,0.35)]" 
              referrerPolicy="no-referrer"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 200 }}
            />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">ZENTRA</h1>
          <p className="text-[10px] text-text-dim uppercase tracking-widest mt-2 font-bold">{t('brandTagline')}</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bento-card !bg-white/5 border-white/10 backdrop-blur-xl">
          <h2 className="text-xs font-black uppercase mb-8 border-b border-white/5 pb-4 tracking-widest">
            {isLogin ? t('systemAccess') : t('createAccount')}
          </h2>

          {error && (
            <div className="bg-loss/10 border border-loss/50 p-4 mb-8 text-[10px] text-loss uppercase font-black rounded-xl animate-shake">
              {t('errorLabel')}: {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase text-text-dim mb-2 font-bold tracking-widest">{t('emailLabel')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs focus:outline-none focus:border-accent transition-all font-bold"
                placeholder="name@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-text-dim mb-2 font-bold tracking-widest">{t('passwordLabel')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs focus:outline-none focus:border-accent transition-all font-bold"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-accent to-lime-500 text-bg py-4 rounded-xl text-sm uppercase font-black tracking-widest hover:scale-[1.01] active:scale-95 transition-all shadow-[0_14px_30px_-10px_rgba(124,255,26,0.28)]"
            >
              {isLogin ? t('signIn') : t('register')}
            </button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[9px] uppercase font-bold tracking-widest">
              <span className="bg-[#0A0A0A] px-4 text-text-dim">{t('orContinueWith')}</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-[#0b0b0b] border border-white/6 py-4 rounded-xl text-sm uppercase font-black tracking-widest hover:scale-105 transition-transform shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
            <span className="ml-2">{t('googleAccount')}</span>
          </button>

          <p className="mt-10 text-center text-[10px] text-text-dim uppercase font-bold tracking-widest">
            {isLogin ? t('noAccount') : t('haveAccount')}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-accent font-black hover:underline"
            >
              {isLogin ? t('registerNow') : t('signInNow')}
            </button>
          </p>
        </motion.div>

        <div className="mt-12 flex items-center justify-center gap-2 opacity-20">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[8px] uppercase tracking-widest font-bold">{t('authSecurityActive')}</span>
        </div>
      </div>
    </div>
  );
}
