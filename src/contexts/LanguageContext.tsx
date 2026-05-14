import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'es' | 'en' | 'pt';

type Translations = Record<string, Record<Language, string>>;

const translations: Translations = {
  brandName: { es: 'ZENTRA', en: 'ZENTRA', pt: 'ZENTRA' },
  brandTagline: { es: 'Anticipa el movimiento', en: 'Know before it moves', pt: 'Antecipe o movimento' },
  navFeatures: { es: 'Funciones', en: 'Features', pt: 'Recursos' },
  navHow: { es: 'Como funciona', en: 'How it works', pt: 'Como funciona' },
  navProof: { es: 'Resultados', en: 'Results', pt: 'Resultados' },
  navContact: { es: 'Contacto', en: 'Contact', pt: 'Contato' },
  launchApp: { es: 'Entrar a la app', en: 'Launch app', pt: 'Abrir app' },

  liveMarkets: { es: 'Mercados en vivo', en: 'Live markets', pt: 'Mercados ao vivo' },
  heroTitleA: { es: 'Saber antes de que', en: 'Know before', pt: 'Saber antes de' },
  heroTitleB: { es: 'se mueva', en: 'it moves', pt: 'se mover' },
  heroSub: {
    es: 'ZENTRA combina portafolio, senales, noticias y analisis visual en una terminal pensada para anticipar movimientos con contexto y sin ruido.',
    en: 'ZENTRA combines portfolio tracking, signals, news and visual analytics in one terminal built to anticipate market moves with context.',
    pt: 'O ZENTRA combina carteira, sinais, noticias e analise visual em um terminal feito para antecipar movimentos com contexto.',
  },
  startTrading: { es: 'Empezar ahora', en: 'Start now', pt: 'Comecar agora' },
  trustedBy: {
    es: 'Anticipa el movimiento',
    en: 'Know before it moves',
    pt: 'Antecipe o movimento',
  },

  statMarketsDetail: { es: 'Acciones + crypto', en: 'Stocks + crypto', pt: 'Acoes + cripto' },
  statSignalsDetail: { es: 'Eventos de mercado IA', en: 'AI market events', pt: 'Eventos de mercado IA' },
  statLatencyDetail: { es: 'Actualizacion rapida', en: 'Signal refresh', pt: 'Atualizacao rapida' },
  statCoverageDetail: { es: 'Siempre atento', en: 'Always watching', pt: 'Sempre atento' },
  scroll: { es: 'Desliza', en: 'Scroll', pt: 'Role' },

  statMarkets: { es: 'Mercados', en: 'Markets', pt: 'Mercados' },
  statSignals: { es: 'Senales diarias', en: 'Daily signals', pt: 'Sinais diarios' },
  statLatency: { es: 'Lectura rapida', en: 'Fast reads', pt: 'Leitura rapida' },
  statCoverage: { es: 'Cobertura global', en: 'Global coverage', pt: 'Cobertura global' },
  tagPortfolio: { es: 'Portafolio', en: 'Portfolio', pt: 'Carteira' },
  tagSignals: { es: 'Senales', en: 'Signals', pt: 'Sinais' },
  tagWatchlist: { es: 'Watchlist', en: 'Watchlist', pt: 'Watchlist' },
  tagNews: { es: 'Noticias', en: 'News', pt: 'Noticias' },
  tagCharts: { es: 'Graficos', en: 'Charts', pt: 'Graficos' },
  retentionSignal: { es: 'Senal de retencion', en: 'Retention Signal', pt: 'Sinal de retencao' },
  marketScan: { es: 'Escaneo de mercado', en: 'Market scan', pt: 'Leitura de mercado' },
  fastReadsMetric: { es: 'Lecturas rapidas', en: 'Fast reads', pt: 'Leituras rapidas' },
  assetsMetric: { es: 'Activos', en: 'Assets', pt: 'Ativos' },

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
  errorLabel: { es: 'Error', en: 'Error', pt: 'Erro' },
  googleAccount: { es: 'Cuenta de Google', en: 'Google Account', pt: 'Conta Google' },
  authSecurityActive: { es: 'Cifrado activo de extremo a extremo', en: 'End-to-End Encryption Active', pt: 'Criptografia de ponta a ponta ativa' },

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
  zentraChatButton: { es: 'AI ZENTRA Chat', en: 'AI ZENTRA Chat', pt: 'AI ZENTRA Chat' },
  zentraChatTitle: { es: 'AI ZENTRA Chat', en: 'AI ZENTRA Chat', pt: 'AI ZENTRA Chat' },
  zentraChatSubtitle: {
    es: 'Solo finanzas, activos, noticias y portfolio',
    en: 'Finance, assets, news and portfolio only',
    pt: 'Somente financas, ativos, noticias e carteira',
  },
  zentraChatGreeting: {
    es: 'Preguntame sobre acciones, crypto, noticias de mercado, tu portfolio o funciones de ZENTRA. Si es fuera de finanzas, no voy a responder.',
    en: 'Ask me about stocks, crypto, market news, your portfolio or ZENTRA features. If it is outside finance, I will not answer.',
    pt: 'Pergunte sobre acoes, cripto, noticias de mercado, sua carteira ou recursos do ZENTRA. Se for fora de financas, nao vou responder.',
  },
  zentraChatPlaceholder: {
    es: 'Pregunta sobre mercados, portfolio o activos...',
    en: 'Ask about markets, portfolio or assets...',
    pt: 'Pergunte sobre mercados, carteira ou ativos...',
  },
  zentraChatUnavailable: {
    es: 'No pude conectar con AI ZENTRA ahora. Puedo ayudarte con activos, noticias, portfolio, riesgos y contexto financiero cuando el servicio responda.',
    en: 'I could not reach AI ZENTRA right now. I can help with assets, news, portfolio, risks and financial context when the service responds.',
    pt: 'Nao consegui conectar com o AI ZENTRA agora. Posso ajudar com ativos, noticias, carteira, riscos e contexto financeiro quando o servico responder.',
  },

  help: { es: 'Ayuda', en: 'Help', pt: 'Ajuda' },
  info: { es: 'Informacion', en: 'Info', pt: 'Informacao' },
  support: { es: 'Soporte', en: 'Support', pt: 'Suporte' },
  helpTitle: { es: 'Preguntas frecuentes y soporte', en: 'FAQ and support', pt: 'Perguntas frequentes e suporte' },
  helpIntro: {
    es: 'Respuestas rapidas y un formulario privado de soporte. Tu mensaje llega al creador del proyecto sin mostrar el email de destino en la app.',
    en: 'Quick answers plus a private support form. Your message goes to the project owner without exposing the destination email in the app.',
    pt: 'Respostas rapidas e um formulario privado de suporte. Sua mensagem chega ao criador do projeto sem mostrar o email de destino no app.',
  },
  faqTitle: { es: 'Preguntas frecuentes', en: 'Frequently asked questions', pt: 'Perguntas frequentes' },
  faqMoneyQuestion: { es: 'ZENTRA mueve dinero u opera por mi?', en: 'Does ZENTRA move money or trade for me?', pt: 'O ZENTRA move dinheiro ou opera por mim?' },
  faqMoneyAnswer: {
    es: 'No. ZENTRA es una herramienta de investigacion y seguimiento de portafolio. Las wallets son solo lectura y las importaciones siempre se revisan antes de guardar.',
    en: 'No. ZENTRA is a research and portfolio tracking tool. Wallet links are read-only and portfolio imports always ask you to review before saving.',
    pt: 'Nao. O ZENTRA e uma ferramenta de pesquisa e acompanhamento de carteira. As wallets sao somente leitura e as importacoes sempre pedem revisao antes de salvar.',
  },
  faqWalletQuestion: { es: 'Que significa conectar una wallet solo lectura?', en: 'What does read-only wallet connection mean?', pt: 'O que significa conectar uma wallet somente leitura?' },
  faqWalletAnswer: {
    es: 'Significa que ZENTRA puede ver una direccion publica y balances publicos de blockchain. Nunca pide seed phrase, private keys, approvals, firmas ni transacciones.',
    en: 'It means ZENTRA can see a public wallet address and public blockchain balances. It never asks for seed phrases, private keys, token approvals, signatures, or transactions.',
    pt: 'Significa que o ZENTRA pode ver um endereco publico e saldos publicos da blockchain. Nunca pede seed phrase, chaves privadas, approvals, assinaturas ou transacoes.',
  },
  faqImportQuestion: { es: 'Puedo importar posiciones desde capturas o archivos?', en: 'Can I import positions from screenshots or files?', pt: 'Posso importar posicoes de capturas ou arquivos?' },
  faqImportAnswer: {
    es: 'Si. Puedes subir capturas, CSV/TXT, Excel y Word. La IA extrae posibles posiciones y tu apruebas las filas antes de importarlas.',
    en: 'Yes. You can upload screenshots, CSV/TXT files, Excel spreadsheets and Word documents. AI extracts possible positions and you approve the rows before importing.',
    pt: 'Sim. Voce pode subir capturas, CSV/TXT, Excel e Word. A IA extrai possiveis posicoes e voce aprova as linhas antes de importar.',
  },
  faqAiQuestion: { es: 'La IA es asesoramiento financiero?', en: 'Is AI financial advice?', pt: 'A IA e aconselhamento financeiro?' },
  faqAiAnswer: {
    es: 'No. Las respuestas de IA son contexto de mercado. Pueden estar incompletas o equivocadas, asi que la decision siempre queda en el usuario.',
    en: 'No. AI responses are market context only. They can be wrong or incomplete, so every decision stays with the user.',
    pt: 'Nao. As respostas da IA sao apenas contexto de mercado. Podem estar incompletas ou erradas, entao a decisao sempre fica com o usuario.',
  },
  contactSupport: { es: 'Contactar soporte', en: 'Contact support', pt: 'Contatar suporte' },
  namePlaceholder: { es: 'Nombre', en: 'Name', pt: 'Nome' },
  yourEmailPlaceholder: { es: 'Tu email *', en: 'Your email *', pt: 'Seu email *' },
  subjectPlaceholder: { es: 'Asunto', en: 'Subject', pt: 'Assunto' },
  supportMessagePlaceholder: { es: 'Como puedo ayudarte? *', en: 'How can I help? *', pt: 'Como posso ajudar? *' },
  sending: { es: 'Enviando', en: 'Sending', pt: 'Enviando' },
  sendMessage: { es: 'Enviar mensaje', en: 'Send message', pt: 'Enviar mensagem' },
  supportSent: { es: 'Mensaje enviado. Lo voy a revisar lo antes posible.', en: 'Message sent. I will review it as soon as possible.', pt: 'Mensagem enviada. Vou revisar assim que possivel.' },
  supportLocal: {
    es: 'Mensaje recibido localmente. El envio por email todavia no esta configurado en este entorno.',
    en: 'Message received locally. Email delivery is not configured on this environment yet.',
    pt: 'Mensagem recebida localmente. O envio por email ainda nao esta configurado neste ambiente.',
  },
  supportFailed: { es: 'No se pudo enviar el mensaje ahora. Intenta de nuevo mas tarde.', en: 'Could not send the message right now. Please try again later.', pt: 'Nao foi possivel enviar a mensagem agora. Tente novamente mais tarde.' },

  infoTitle: { es: 'Por que existe ZENTRA', en: 'Why ZENTRA exists', pt: 'Por que o ZENTRA existe' },
  infoIntro: {
    es: 'ZENTRA esta pensado para reducir la friccion entre tener inversiones y entenderlas de verdad. El edge no es solo graficos o IA. El edge es registrar posiciones facil, revisar contexto y ser honesto con el riesgo.',
    en: 'ZENTRA is built to reduce the friction between having investments and actually understanding them. The edge is not only charts or AI. The edge is making it easy to register positions, inspect context and stay honest about risk.',
    pt: 'O ZENTRA foi criado para reduzir a friccao entre ter investimentos e entende-los de verdade. O edge nao e so graficos ou IA. O edge e registrar posicoes com facilidade, revisar contexto e ser honesto com o risco.',
  },
  theIdea: { es: 'La idea', en: 'The idea', pt: 'A ideia' },
  ideaTextOne: {
    es: 'ZENTRA nace de una idea simple: invertir no deberia sentirse como tener diez pestanas abiertas, precios que no coinciden y capturas perdidas en el celular.',
    en: 'ZENTRA starts from a simple idea: investing should not feel like ten open tabs, mismatched prices and screenshots lost on your phone.',
    pt: 'O ZENTRA nasce de uma ideia simples: investir nao deveria parecer dez abas abertas, precos desencontrados e capturas perdidas no celular.',
  },
  ideaTextTwo: {
    es: 'La app organiza todo en una terminal viva: portafolio, heat maps, precios, noticias, wallets solo lectura e IA para transformar informacion dispersa en una lectura clara.',
    en: 'The app organizes everything into a living terminal: portfolio, heat maps, prices, news, read-only wallets and AI that turns scattered information into a clear read.',
    pt: 'O app organiza tudo em um terminal vivo: carteira, heat maps, precos, noticias, wallets somente leitura e IA para transformar informacao dispersa em uma leitura clara.',
  },
  ideaTextThree: {
    es: 'El objetivo no es prometer ganancias. Es darle al usuario menos friccion, mas control y una forma honesta de entender que tiene, cuanto pago y que esta cambiando en el mercado.',
    en: 'The goal is not to promise returns. It is to give users less friction, more control and an honest way to understand what they hold, what they paid and what is changing in the market.',
    pt: 'O objetivo nao e prometer retornos. E dar ao usuario menos atrito, mais controle e uma forma honesta de entender o que possui, quanto pagou e o que esta mudando no mercado.',
  },
  ideaPillarOne: { es: 'Registrar inversiones sin friccion', en: 'Register investments without friction', pt: 'Registrar investimentos sem atrito' },
  ideaPillarTwo: { es: 'Leer mercado con contexto', en: 'Read the market with context', pt: 'Ler o mercado com contexto' },
  ideaPillarThree: { es: 'Construir confianza con transparencia', en: 'Build trust through transparency', pt: 'Construir confianca com transparencia' },
  securityPosture: { es: 'Postura de seguridad', en: 'Security posture', pt: 'Postura de seguranca' },
  securityOne: { es: 'Las wallets son solo lectura salvo que se indique explicitamente lo contrario.', en: 'Wallet connections are read-only unless explicitly stated.', pt: 'Conexoes de wallet sao somente leitura salvo indicacao explicita em contrario.' },
  securityTwo: { es: 'ZENTRA nunca pide seed phrases ni private keys.', en: 'ZENTRA never asks for seed phrases or private keys.', pt: 'O ZENTRA nunca pede seed phrases ou chaves privadas.' },
  securityThree: { es: 'No hacen falta approvals ni transacciones para trackear portafolio.', en: 'No token approvals or trading transactions are needed for portfolio tracking.', pt: 'Nao sao necessarios approvals ou transacoes para acompanhar a carteira.' },
  securityFour: { es: 'Las importaciones con IA siempre muestran una tabla de revision antes de guardar.', en: 'AI imports always show a review table before saving to your portfolio.', pt: 'Importacoes com IA sempre mostram uma tabela de revisao antes de salvar.' },
  securityFive: { es: 'Las API keys quedan en el servidor y no se exponen al navegador.', en: 'API keys stay on the server and are not exposed to the browser.', pt: 'As API keys ficam no servidor e nao sao expostas ao navegador.' },
  openness: { es: 'Transparencia', en: 'Openness', pt: 'Transparencia' },
  opennessText: {
    es: 'Decir que ZENTRA es un proyecto individual puede ser una fortaleza. Se siente honesto, humano y responsable. La clave es acompanarlo con lenguaje claro de seguridad, limites visibles y trabajo publico.',
    en: 'Being transparent that ZENTRA is an individual project can be a strength. It feels honest, human and accountable. The key is to pair that with strong security language, clear limitations and visible public work.',
    pt: 'Ser transparente que o ZENTRA e um projeto individual pode ser uma forca. Parece honesto, humano e responsavel. A chave e combinar isso com seguranca clara, limites visiveis e trabalho publico.',
  },
  publicProfiles: { es: 'Perfiles publicos', en: 'Public profiles', pt: 'Perfis publicos' },
  publicProfilesText: {
    es: 'GitHub ayuda a que los usuarios verifiquen que el proyecto es real y esta mantenido. Manten secretos fuera del repo y evita exponer informacion privada en commits.',
    en: 'GitHub is useful if you want users to verify that the project is real and actively maintained. Keep secrets out of the repo and avoid exposing anything private in commits.',
    pt: 'GitHub ajuda usuarios a verificar que o projeto e real e esta em manutencao. Mantenha segredos fora do repo e evite expor informacoes privadas em commits.',
  },
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
