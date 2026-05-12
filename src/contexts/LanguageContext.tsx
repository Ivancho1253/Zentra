import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'es' | 'en' | 'pt';

type Translations = Record<string, Record<Language, string>>;

const translations: Translations = {
  brandName: { es: 'ZENTRA', en: 'ZENTRA', pt: 'ZENTRA' },
  brandTagline: { es: 'Know before it moves', en: 'Know before it moves', pt: 'Know before it moves' },
  navFeatures: { es: 'Funciones', en: 'Features', pt: 'Recursos' },
  navHow: { es: 'Como funciona', en: 'How it works', pt: 'Como funciona' },
  navProof: { es: 'Resultados', en: 'Results', pt: 'Resultados' },
  navContact: { es: 'Contacto', en: 'Contact', pt: 'Contato' },
  launchApp: { es: 'Entrar a la app', en: 'Launch app', pt: 'Abrir app' },

  liveMarkets: { es: 'Mercados en vivo', en: 'Live markets', pt: 'Mercados ao vivo' },
  heroTitleA: { es: 'Sabe antes de que', en: 'Know before', pt: 'Saiba antes de' },
  heroTitleB: { es: 'el mercado se mueva', en: 'it moves', pt: 'o mercado se mover' },
  heroSub: {
    es: 'ZENTRA combina portafolio, senales, noticias y analisis visual en una terminal pensada para anticipar movimientos con contexto y sin ruido.',
    en: 'ZENTRA combines portfolio tracking, signals, news and visual analytics in one terminal built to anticipate market moves with context.',
    pt: 'O ZENTRA combina carteira, sinais, noticias e analise visual em um terminal feito para antecipar movimentos com contexto.',
  },
  startTrading: { es: 'Empezar ahora', en: 'Start now', pt: 'Comecar agora' },
  trustedBy: {
    es: 'Know before it moves',
    en: 'Know before it moves',
    pt: 'Know before it moves',
  },

  statMarkets: { es: 'Mercados', en: 'Markets', pt: 'Mercados' },
  statSignals: { es: 'Senales diarias', en: 'Daily signals', pt: 'Sinais diarios' },
  statLatency: { es: 'Lectura rapida', en: 'Fast reads', pt: 'Leitura rapida' },
  statCoverage: { es: 'Cobertura global', en: 'Global coverage', pt: 'Cobertura global' },

  featuresKicker: { es: 'Todo lo que necesitas', en: 'Everything you need', pt: 'Tudo o que voce precisa' },
  featuresTitle: {
    es: 'Una terminal que convierte datos dispersos en decisiones claras.',
    en: 'One terminal that turns scattered data into clear decisions.',
    pt: 'Um terminal que transforma dados dispersos em decisoes claras.',
  },
  featuresSub: {
    es: 'Menos pestanas, menos friccion y mas contexto accionable en cada movimiento.',
    en: 'Fewer tabs, less friction and more actionable context in every move.',
    pt: 'Menos abas, menos atrito e mais contexto acionavel em cada movimento.',
  },
  featurePortfolioTitle: { es: 'Portafolio vivo', en: 'Live portfolio', pt: 'Carteira ao vivo' },
  featurePortfolioDesc: {
    es: 'Tus posiciones, exposicion y actividad reciente en una vista densa y facil de leer.',
    en: 'Positions, exposure and recent activity in a dense, readable view.',
    pt: 'Posicoes, exposicao e atividade recente em uma visualizacao densa e legivel.',
  },
  featureSignalsTitle: { es: 'Senales con contexto', en: 'Contextual signals', pt: 'Sinais com contexto' },
  featureSignalsDesc: {
    es: 'Precios, momentum, sentimiento y noticias alineados para no operar a ciegas.',
    en: 'Prices, momentum, sentiment and news aligned so you never trade blind.',
    pt: 'Precos, momentum, sentimento e noticias alinhados para nao operar as cegas.',
  },
  featureWatchlistTitle: { es: 'Watchlist inteligente', en: 'Smart watchlist', pt: 'Watchlist inteligente' },
  featureWatchlistDesc: {
    es: 'Favoritos, tendencias y activos calientes listos para inspeccion inmediata.',
    en: 'Favorites, trends and hot assets ready for immediate inspection.',
    pt: 'Favoritos, tendencias e ativos em destaque prontos para inspecao imediata.',
  },
  featureFlowTitle: { es: 'Flujo sin distracciones', en: 'Distraction-free flow', pt: 'Fluxo sem distracoes' },
  featureFlowDesc: {
    es: 'Interfaz oscura, visual y directa para sesiones largas de analisis.',
    en: 'A dark, visual, direct interface for long analysis sessions.',
    pt: 'Interface escura, visual e direta para longas sessoes de analise.',
  },

  howKicker: { es: 'Como funciona', en: 'How it works', pt: 'Como funciona' },
  howTitle: { es: 'De senal a accion en cuatro pasos.', en: 'From signal to action in four steps.', pt: 'Do sinal a acao em quatro passos.' },
  stepOneTitle: { es: 'Conecta', en: 'Connect', pt: 'Conecte' },
  stepOneDesc: { es: 'Crea tu cuenta y empieza con tu portafolio real.', en: 'Create your account and start with your real portfolio.', pt: 'Crie sua conta e comece com sua carteira real.' },
  stepTwoTitle: { es: 'Explora', en: 'Explore', pt: 'Explore' },
  stepTwoDesc: { es: 'Busca acciones y criptos con precios, favoritos y detalles.', en: 'Search stocks and crypto with prices, favorites and details.', pt: 'Busque acoes e cripto com precos, favoritos e detalhes.' },
  stepThreeTitle: { es: 'Evalua', en: 'Evaluate', pt: 'Avalie' },
  stepThreeDesc: { es: 'Combina graficos, noticias y sentimiento en una sola lectura.', en: 'Combine charts, news and sentiment in one read.', pt: 'Combine graficos, noticias e sentimento em uma leitura.' },
  stepFourTitle: { es: 'Decide', en: 'Decide', pt: 'Decida' },
  stepFourDesc: { es: 'Actua con mas contexto y menos ruido operativo.', en: 'Act with more context and less operational noise.', pt: 'Aja com mais contexto e menos ruido operacional.' },

  proofKicker: { es: 'Resultados', en: 'Results', pt: 'Resultados' },
  proofTitle: { es: 'Hecho para usuarios que vuelven todos los dias.', en: 'Built for users who come back every day.', pt: 'Feito para usuarios que voltam todos os dias.' },
  proofSub: {
    es: 'ZENTRA vende una experiencia concreta: velocidad, claridad y confianza antes de abrir una posicion.',
    en: 'ZENTRA sells a concrete experience: speed, clarity and confidence before opening a position.',
    pt: 'ZENTRA vende uma experiencia concreta: velocidade, clareza e confianca antes de abrir uma posicao.',
  },
  quoteOne: {
    es: '"Deje de saltar entre cinco herramientas. Ahora veo mercado, cartera y noticias en una sola pantalla."',
    en: '"I stopped jumping between five tools. Now I see market, portfolio and news on one screen."',
    pt: '"Parei de alternar entre cinco ferramentas. Agora vejo mercado, carteira e noticias em uma tela."',
  },
  quoteTwo: {
    es: '"La watchlist y los detalles por activo hacen que investigar oportunidades sea mucho mas rapido."',
    en: '"The watchlist and asset details make researching opportunities much faster."',
    pt: '"A watchlist e os detalhes por ativo deixam a pesquisa de oportunidades muito mais rapida."',
  },
  quoteThree: {
    es: '"Tiene el look de una terminal pro, pero la curva de uso es simple. Eso engancha."',
    en: '"It looks like a pro terminal, but the learning curve is simple. That is sticky."',
    pt: '"Parece um terminal profissional, mas a curva de uso e simples. Isso prende."',
  },
  roleOne: { es: 'Trader activo', en: 'Active trader', pt: 'Trader ativo' },
  roleTwo: { es: 'Analista cripto', en: 'Crypto analyst', pt: 'Analista cripto' },
  roleThree: { es: 'Portfolio manager', en: 'Portfolio manager', pt: 'Gestor de carteira' },

  ctaTitle: { es: 'Convierte tu investigacion en ventaja.', en: 'Turn research into an edge.', pt: 'Transforme pesquisa em vantagem.' },
  ctaSub: {
    es: 'Entra, arma tu portafolio, sigue tus favoritos y empieza a leer el mercado con mas foco.',
    en: 'Sign in, build your portfolio, follow your favorites and read the market with more focus.',
    pt: 'Entre, monte sua carteira, siga favoritos e leia o mercado com mais foco.',
  },
  ctaButton: { es: 'Abrir ZENTRA', en: 'Open ZENTRA', pt: 'Abrir ZENTRA' },
  privacy: { es: 'Privacidad', en: 'Privacy', pt: 'Privacidade' },
  terms: { es: 'Terminos', en: 'Terms', pt: 'Termos' },
  contact: { es: 'Contacto', en: 'Contact', pt: 'Contato' },

  backToLanding: { es: 'Volver al inicio', en: 'Back to landing', pt: 'Voltar ao inicio' },
  systemAccess: { es: 'Acceso al sistema', en: 'System access', pt: 'Acesso ao sistema' },
  createAccount: { es: 'Crear cuenta', en: 'Create account', pt: 'Criar conta' },
  emailLabel: { es: 'Correo electronico', en: 'Email address', pt: 'Endereco de email' },
  passwordLabel: { es: 'Contrasena', en: 'Password', pt: 'Senha' },
  signIn: { es: 'Iniciar sesion', en: 'Sign in', pt: 'Entrar' },
  register: { es: 'Registrarse', en: 'Register', pt: 'Registrar' },
  orContinueWith: { es: 'O continuar con', en: 'Or continue with', pt: 'Ou continuar com' },
  noAccount: { es: 'No tienes cuenta?', en: "Don't have an account?", pt: 'Nao tem uma conta?' },
  haveAccount: { es: 'Ya tienes cuenta?', en: 'Already have an account?', pt: 'Ja tem uma conta?' },
  registerNow: { es: 'Registrate ahora', en: 'Register now', pt: 'Registre-se agora' },
  signInNow: { es: 'Inicia sesion', en: 'Sign in', pt: 'Entrar agora' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return saved === 'es' || saved === 'en' || saved === 'pt' ? saved : 'es';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string) => translations[key]?.[language] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
