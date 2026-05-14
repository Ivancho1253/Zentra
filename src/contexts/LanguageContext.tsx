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

  dashboard: { es: 'Panel', en: 'Dashboard', pt: 'Painel' },
  portfolio: { es: 'Portafolio', en: 'Portfolio', pt: 'Carteira' },
  market: { es: 'Mercado', en: 'Market', pt: 'Mercado' },
  marketNews: { es: 'Noticias', en: 'Market News', pt: 'Noticias' },
  liveEdgeEnabled: { es: 'Ventaja en vivo activa', en: 'Live edge enabled', pt: 'Vantagem ao vivo ativa' },
  premiumUser: { es: 'Usuario premium', en: 'Premium User', pt: 'Usuario premium' },
  logout: { es: 'Cerrar sesion', en: 'Logout', pt: 'Sair' },
  liveMarketData: { es: 'Datos de mercado en vivo', en: 'Live Market Data', pt: 'Dados de mercado ao vivo' },
  switchDarkMode: { es: 'Cambiar a modo oscuro', en: 'Switch to Dark Mode', pt: 'Mudar para modo escuro' },
  switchLightMode: { es: 'Cambiar a modo claro', en: 'Switch to Light Mode', pt: 'Mudar para modo claro' },

  equity: { es: 'Accion', en: 'Equity', pt: 'Acao' },
  digitalAsset: { es: 'Activo digital', en: 'Digital Asset', pt: 'Ativo digital' },
  updatingQuote: { es: 'Actualizando precio', en: 'Updating quote', pt: 'Atualizando preco' },
  liveQuote: { es: 'Precio en vivo', en: 'Live Quote', pt: 'Preco ao vivo' },
  currentPrice: { es: 'Precio actual', en: 'Current Price', pt: 'Preco atual' },
  refreshesEvery15s: { es: 'Actualiza cada 15s', en: 'Refreshes every 15s', pt: 'Atualiza a cada 15s' },
  updating: { es: 'Actualizando', en: 'Updating', pt: 'Atualizando' },
  addFavorite: { es: 'Agregar favorito', en: 'Add Favorite', pt: 'Adicionar favorito' },
  favorited: { es: 'Favorito', en: 'Favorited', pt: 'Favorito' },
  addThisAsset: { es: 'Agregar este activo', en: 'Add This Asset', pt: 'Adicionar este ativo' },
  loginToAddAsset: { es: 'Inicia sesion para agregar este activo a tu portafolio.', en: 'Log in to add this asset to your portfolio.', pt: 'Entre para adicionar este ativo a sua carteira.' },
  waitingValidPrice: { es: 'Esperando un precio valido para agregarlo.', en: 'Waiting for a valid live price before adding.', pt: 'Aguardando um preco valido para adicionar.' },
  addedAsset: { es: 'Agregado al portafolio', en: 'Added to portfolio', pt: 'Adicionado a carteira' },
  couldNotAddAsset: { es: 'No se pudo agregar al portafolio. Revisa permisos o vuelve a intentar.', en: 'Could not add to portfolio. Check permissions or try again.', pt: 'Nao foi possivel adicionar a carteira. Verifique permissoes ou tente novamente.' },
  daily: { es: 'Diario', en: 'Daily', pt: 'Diario' },
  weekly: { es: 'Semanal', en: 'Weekly', pt: 'Semanal' },
  monthly: { es: 'Mensual', en: 'Monthly', pt: 'Mensal' },
  annual: { es: 'Anual', en: 'Annual', pt: 'Anual' },
  performance: { es: 'Rendimiento', en: 'Performance', pt: 'Desempenho' },
  trend: { es: 'Tendencia', en: 'Trend', pt: 'Tendencia' },
  interactiveChart: { es: 'Grafico interactivo', en: 'Interactive Chart', pt: 'Grafico interativo' },
  marketFundamentals: { es: 'Fundamentos del mercado', en: 'Market Fundamentals', pt: 'Fundamentos do mercado' },
  marketCap: { es: 'Capitalizacion', en: 'Market Cap', pt: 'Valor de mercado' },
  volume24h: { es: 'Volumen 24h', en: 'Volume (24h)', pt: 'Volume 24h' },
  lastPrice: { es: 'Ultimo precio', en: 'Last Price', pt: 'Ultimo preco' },
  source: { es: 'Fuente', en: 'Source', pt: 'Fonte' },
  live: { es: 'En vivo', en: 'Live', pt: 'Ao vivo' },
  fallback: { es: 'Respaldo', en: 'Fallback', pt: 'Reserva' },
  technicalSentiment: { es: 'Sentimiento tecnico', en: 'Technical Sentiment', pt: 'Sentimento tecnico' },
  sell: { es: 'Vender', en: 'Sell', pt: 'Vender' },
  strongBuy: { es: 'Compra fuerte', en: 'Strong Buy', pt: 'Compra forte' },
  bullish: { es: 'Alcista', en: 'Bullish', pt: 'Altista' },
  positive: { es: 'Positivo', en: 'Positive', pt: 'Positivo' },
  aiInsight: { es: 'Insight IA', en: 'AI Insight', pt: 'Insight IA' },
  aiInsightText: {
    es: 'ZENTRA detecta interes elevado en este activo. Revisa precio, volumen y riesgo antes de abrir una posicion.',
    en: 'ZENTRA detects elevated market interest in this asset. Review price action, volume and risk before opening a position.',
    pt: 'O ZENTRA detecta interesse elevado neste ativo. Revise preco, volume e risco antes de abrir uma posicao.',
  },
  aiAssetChat: { es: 'Chat IA del activo', en: 'AI Asset Chat', pt: 'Chat IA do ativo' },
  close: { es: 'Cerrar', en: 'Close', pt: 'Fechar' },
  aiGreeting: {
    es: 'Preguntame sobre tendencia, riesgos, catalizadores, valuacion o que mirar en el grafico.',
    en: 'Ask me about trend, risks, catalysts, valuation, or what to inspect on the chart.',
    pt: 'Pergunte sobre tendencia, riscos, catalisadores, avaliacao ou o que observar no grafico.',
  },
  aiThinking: { es: 'Pensando...', en: 'Thinking...', pt: 'Pensando...' },
  askAboutAsset: { es: 'Pregunta sobre este activo...', en: 'Ask about this asset...', pt: 'Pergunte sobre este ativo...' },
  aiUnavailable: {
    es: 'No pude conectar con la IA ahora. Igual puedo mostrarte el contexto actual: precio, variacion y grafico para revisar tendencia, volumen, soportes y resistencias.',
    en: 'I could not reach the AI service right now. I can still show the current context: price, change and chart so you can review trend, volume, support and resistance.',
    pt: 'Nao consegui conectar com a IA agora. Ainda posso mostrar o contexto atual: preco, variacao e grafico para revisar tendencia, volume, suporte e resistencia.',
  },
  aiResponseUnavailable: { es: 'Respuesta de IA no disponible.', en: 'AI response unavailable.', pt: 'Resposta da IA indisponivel.' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    const hasUserPreference = localStorage.getItem('languagePreferenceSet') === 'true';
    return hasUserPreference && (saved === 'es' || saved === 'en' || saved === 'pt') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    localStorage.setItem('languagePreferenceSet', 'true');
    setLanguageState(lang);
  };

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
