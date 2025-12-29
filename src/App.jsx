import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { ShieldCheck, Globe, CheckCircle2, Users } from 'lucide-react';
import './index.css';

// Firebase Client Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
console.log('🔍 [Firebase] Verificando ambiente...');
const detectedViteVars = Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'));
console.log('📡 Variáveis VITE detectadas:', detectedViteVars);

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.warn('⚠️ [Firebase] ATENÇÃO: Algumas variáveis estão faltando na Vercel!');
  if (!firebaseConfig.apiKey) console.warn('- Faltando: VITE_FIREBASE_API_KEY');
  if (!firebaseConfig.projectId) console.warn('- Faltando: VITE_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.appId) console.warn('- Faltando: VITE_FIREBASE_APP_ID');
  console.log('Dica: Certifique-se de que adicionou com o prefixo VITE_, marcou "Production" e clicou em Redeploy.');
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Localization Dictionary ---
const translations = {
  en: {
    heroTitle: "Let's manage your finances now, to make the future easier",
    heroDesc: "Penny is your automated financial companion. Just text your expenses on WhatsApp, and we'll do the magic. No apps to download, no friction.",
    getStarted: "Get Started",
    introduction: "Introduction",
    happyCustomers: "Happy Customers",
    yearsExp: "Years of exp",
    countries: "Countries",
    featuresTitle: "We are a platform with the most complete features",
    feature1Title: "Guaranteed safety",
    feature1Desc: "All forms of transactions and information about your finances are 100% protected.",
    feature2Title: "Saving global payments",
    feature2Desc: "Penny is present in 2 countries, this makes us provide payment features globally.",
    feature3Title: "Verified Platform",
    feature3Desc: "Penny is a verified payment platform according to government regulations.",
    manageFinancesTitle: "We help you to manage your finances neatly and clearly",
    manageFinancesDesc: "All forms of your transactions will be summarized in statistics and expense details. For use in your detailed financial report.",
    learnMore: "Learn more",
    dashboard: "Dashboard",
    welcome: "Welcome back",
    totalSpent: "Balance",
    activityStats: "Activity Statistics",
    spendingGoal: "Expenses",
    recentTransactions: "Recent Transactions",
    seeAll: "See All",
    noTransactions: "No transactions recorded yet.",
    week: "Week",
    month: "Month",
    footerDesc: "The easiest way to track your money, right from your WhatsApp.",
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    categories: {
      Food: 'Food',
      Transport: 'Transport',
      Shopping: 'Shopping',
      Leisure: 'Leisure',
      General: 'General',
      Bills: 'Bills'
    },
    disarm: "Emergency Disconnect",
    disarmSuccess: "Disconnected for your security!",
    disarmError: "Failed to disconnect. Try manually.",
    pricingTitle: "Flexible Plans for You",
    pricingDesc: "Choose the plan that best fits your financial management needs.",
    monthly: "Monthly",
    annual: "Limited Offer",
    perMonth: "/month",
    perYear: "/lifetime",
    oneTime: "one-time",
    limitedOffer: "Founder's Lifetime Access",
    limitedOfferDesc: "Special offer for the first 30 members!",
    selectPlan: "Select Plan",
    affiliateMsg: "After becoming a subscriber, become an affiliate and for each new customer you refer, receive 60% of the value of the new subscriber."
  },
  pt: {
    heroTitle: "Gerencie suas finanças agora, para um futuro mais tranquilo",
    heroDesc: "O Penny é seu companheiro financeiro automatizado. Basta enviar seus gastos pelo WhatsApp e nós cuidamos do resto. Sem apps para baixar, sem fricção.",
    getStarted: "Começar Agora",
    introduction: "Introdução",
    happyCustomers: "Clientes Felizes",
    yearsExp: "Anos de exp",
    countries: "Países",
    featuresTitle: "Somos a plataforma com as funcionalidades mais completas",
    feature1Title: "Segurança Garantida",
    feature1Desc: "Todas as formas de transações e informações sobre suas finanças estão 100% protegidas.",
    feature2Title: "Pagamentos Globais",
    feature2Desc: "O Penny está presente em 2 países, permitindo recursos de pagamento globais.",
    feature3Title: "Plataforma Verificada",
    feature3Desc: "O Penny é uma plataforma de pagamento verificada de acordo com as regulamentações governamentais.",
    manageFinancesTitle: "Ajudamos você a gerenciar suas finanças de forma clara",
    manageFinancesDesc: "Todas as suas transações serão resumidas em estatísticas e detalhes de gastos para seu relatório financeiro.",
    learnMore: "Saiba mais",
    dashboard: "Painel",
    welcome: "Bem-vindo de volta",
    totalSpent: "Saldo",
    activityStats: "Estatísticas de Atividade",
    spendingGoal: "Gastos",
    recentTransactions: "Transações Recentes",
    seeAll: "Ver Tudo",
    noTransactions: "Nenhuma transação registrada ainda.",
    week: "Semana",
    month: "Mês",
    footerDesc: "A maneira mais fácil de organizar seu dinheiro, direto pelo seu WhatsApp.",
    days: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    categories: {
      Food: 'Alimentação',
      Transport: 'Transporte',
      Shopping: 'Compras',
      Leisure: 'Lazer',
      General: 'Geral',
      Bills: 'Contas'
    },
    disarm: "Botão de Desarme (Pânico)",
    disarmSuccess: "Número desconectado para sua segurança!",
    disarmError: "Falha ao desconectar. Tente manualmente.",
    pricingTitle: "Planos Flexíveis para Você",
    pricingDesc: "Escolha o plano que melhor se adapta às suas necessidades de gestão financeira.",
    monthly: "Mensal",
    annual: "Oferta Limitada",
    perMonth: "/mês",
    perYear: "/único",
    oneTime: "pagamento único",
    limitedOffer: "Acesso Vitalício Fundador",
    limitedOfferDesc: "Oferta especial para os primeiros 30 membros!",
    selectPlan: "Escolher Plano",
    affiliateMsg: "Após ser assinante seja um afiliado e a cada novo cliente por indicação sua receba 60% do valor do novo assinante."
  }
};

function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBrazil, setIsBrazil] = useState(false);
  const [localeLoaded, setLocaleLoaded] = useState(false);

  // 1. Get User ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('user');

  // Detect Country by IP
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.country_code === 'BR') {
          console.log("🇧🇷 [Região] Brasil detectado via IP. Mudando para R$.");
          setIsBrazil(true);
        } else {
          console.log(`🌍 [Região] País detectado: ${data.country_name}. Mantendo GBP.`);
        }
      })
      .catch(err => console.error("Localization error:", err))
      .finally(() => setLocaleLoaded(true));
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'usuarios', userId, 'transactions'), 
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionsData = [];
      snapshot.forEach((doc) => {
        transactionsData.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(transactionsData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleDisarm = async () => {
    const confirmDisarm = window.confirm(t.disarm + "?");
    if (!confirmDisarm) return;

    try {
      const response = await fetch('https://penny-finance-backend.fly.dev/api/sys/disarm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'SuaChaveMestra123' // Fallback or matching Evolution Key
        },
        body: JSON.stringify({ instance: 'OfficialMeta' }) // Default instance
      });

      if (response.ok) {
        alert(t.disarmSuccess);
      } else {
        alert(t.disarmError);
      }
    } catch (err) {
      alert(t.disarmError);
    }
  };

  const t = isBrazil ? translations.pt : translations.en;

  const formatCurrency = (amount) => {
    const symbol = isBrazil ? 'R$' : '£';
    const loc = isBrazil ? 'pt-BR' : 'en-GB';
    return `${symbol}${parseFloat(amount || 0).toLocaleString(loc, { minimumFractionDigits: 2 })}`;
  };

  const parseSafeDate = (dateValue) => {
    if (!dateValue || dateValue === 'N/A') return null;
    if (dateValue && typeof dateValue === 'object' && dateValue.seconds !== undefined) {
      return new Date(dateValue.seconds * 1000);
    }
    if (typeof dateValue === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateValue)) {
      const [day, month, year] = dateValue.split('/');
      return new Date(year, month - 1, day);
    }
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (dateValue, fallbackValue) => {
    let date = parseSafeDate(dateValue);
    if (!date && fallbackValue) date = parseSafeDate(fallbackValue);
    if (!date) return '---';
    
    return date.toLocaleDateString(isBrazil ? 'pt-BR' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // --- Cálculos Dinâmicos ---
  
  // 0. User Profile Data (for logic)
  const [userData, setUserData] = useState({});
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onSnapshot(doc(db, 'usuarios', userId), (doc) => {
      setUserData(doc.exists() ? doc.data() : {});
    });
    return () => unsubscribe();
  }, [userId]);

  // 1. Totais
  const totalExpenses = transactions
    .filter((t) => t.type !== 'income' && t.type !== 'error') 
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const balance = totalIncome - totalExpenses;

  // 2. Spending Percentage (Based on income if available, else 1% per transaction)
  const incomeAsNumber = parseFloat(userData?.monthlyIncome || 0);
  const spendingPercentage = incomeAsNumber > 0 
    ? Math.min(Math.round((totalExpenses / incomeAsNumber) * 100), 100)
    : Math.min(transactions.length, 100);

  // 3. Agrupamento por Categorias Dinâmico
  const categoriesMap = transactions
    .filter(tx => (tx.type === 'expense' || !tx.type) && tx.type !== 'error')
    .reduce((acc, tx) => {
      // Map DB category (usually English) to the translation key
      let catKey = tx.category || 'General';
      // Normalize to match translations keys
      const foundKey = Object.keys(t.categories).find(
        key => key.toLowerCase() === catKey.toLowerCase()
      ) || 'General';
      
      const translatedName = t.categories[foundKey] || foundKey;
      acc[translatedName] = (acc[translatedName] || 0) + parseFloat(tx.amount || 0);
      return acc;
    }, {});

  // Categorias principais para exibir no dashboard (mesmo que vazias)
  const mainCategories = [
    { name: t.categories.Food, color: 'bg-orange-500' },
    { name: t.categories.Transport, color: 'bg-blue-500' },
    { name: t.categories.Shopping, color: 'bg-pink-500' },
    { name: t.categories.Leisure, color: 'bg-purple-500' },
    { name: t.categories.Bills, color: 'bg-red-500' }
  ];

  // 4. Atividade Semanal (Volume de transações por dia)
  const daysOfWeek = t.days;
  const dailyActivity = daysOfWeek.map((day, index) => {
    // Sum transaction amounts per day (only for expenses/untyped)
    const totalAmount = transactions
      .filter((t) => {
        const date = parseSafeDate(t.date) || parseSafeDate(t.createdAt);
        return date && date.getDay() === index && (t.type === 'expense' || !t.type) && t.type !== 'error';
      })
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    
    return totalAmount;
  });

  // Chart heights: R$ 500 = 100% (full bar)
  const MAX_CHART_THRESHOLD = 500;
  const chartHeights = dailyActivity;

  // --- Components ---

  const LandingPage = () => (
    <div className="min-h-screen bg-black text-white selection:bg-primary selection:text-black overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-black font-bold">P</span>
            </div>
            <span className="text-xl font-bold tracking-tighter">Penny</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">{isBrazil ? "Funcionalidades" : "Features"}</a>
            <a href="#preview" className="hover:text-white transition-colors">{isBrazil ? "Prévia" : "Preview"}</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">{isBrazil ? "Como funciona" : "How it works"}</a>
          </div>
          <a href="#pricing" className="px-5 py-2 bg-primary text-black text-sm font-bold rounded-full hover:scale-105 transition-transform">
            {t.getStarted}
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-16">
          <div className="max-w-4xl text-center">
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
              {t.heroTitle.split('finances')[0]}<span className="text-primary italic">{isBrazil ? "finanças" : "finances"}</span>{t.heroTitle.split('finances')[1]}
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-6 leading-relaxed">
              {t.heroDesc}
            </p>
            <div className="flex items-center justify-center gap-2 mb-10 max-w-lg mx-auto">
              <Users className="w-4 h-4 text-primary" />
              <p className="text-sm text-primary/80 font-medium">
                {t.affiliateMsg}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#pricing" className="w-full sm:w-auto px-8 py-4 bg-primary text-black font-bold rounded-full hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all text-center">
                {t.getStarted}
              </a>
              <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
                {t.introduction}
              </button>
            </div>
            <div className="mt-12 flex items-center justify-center gap-8">
              <div><p className="text-2xl font-bold">25k+</p><p className="text-xs text-gray-500 uppercase tracking-widest">{t.happyCustomers}</p></div>
              <div className="w-px h-8 bg-white/10"></div>
              <div><p className="text-2xl font-bold">2</p><p className="text-xs text-gray-500 uppercase tracking-widest">{t.yearsExp}</p></div>
              <div className="w-px h-8 bg-white/10"></div>
              <div><p className="text-2xl font-bold">2</p><p className="text-xs text-gray-500 uppercase tracking-widest">{t.countries}</p></div>
            </div>
          </div>
        </div>
      </section>


      {/* Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">{t.featuresTitle.split('<br/>')[0]} <br/> {t.featuresTitle.split('<br/>')[1]}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: t.feature1Title, desc: t.feature1Desc, icon: <ShieldCheck className="w-6 h-6 text-primary" /> },
              { title: t.feature2Title, desc: t.feature2Desc, icon: <Globe className="w-6 h-6 text-primary" /> },
              { title: t.feature3Title, desc: t.feature3Desc, icon: <CheckCircle2 className="w-6 h-6 text-primary" /> }
            ].map((f, i) => (
              <div key={i} className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors group">
                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-4">{f.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-6 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">{t.pricingTitle}</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">{t.pricingDesc}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Monthly Plan */}
            <div className="p-10 bg-white/5 border border-white/10 rounded-[32px] hover:border-white/20 transition-all flex flex-col justify-between">
              <div>
                <span className="text-primary text-xs font-bold uppercase tracking-widest">{t.monthly}</span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-black">€9,99</span>
                  <span className="text-gray-500 font-medium">{t.perMonth}</span>
                </div>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-center gap-3 text-gray-400"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Controle via WhatsApp" : "Control via WhatsApp"}</li>
                  <li className="flex items-center gap-3 text-gray-400"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Relatórios Mensais" : "Monthly Reports"}</li>
                  <li className="flex items-center gap-3 text-gray-400"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Suporte Prioritário" : "Priority Support"}</li>
                  <li className="flex items-center gap-3 text-gray-400"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Histórico de Transações" : "Transaction History"}</li>
                  <li className="flex items-center gap-3 text-gray-400"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Categorização Automática" : "Automatic Categorization"}</li>
                  <li className="flex items-center gap-3 text-gray-400"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Resumo Diário Opcional" : "Optional Daily Summary"}</li>
                </ul>
              </div>
              <button className="mt-12 w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold transition-all">
                {t.selectPlan}
              </button>
            </div>

            {/* Annual Plan - Special Offer */}
            <div className="relative p-10 bg-primary/10 border-2 border-primary rounded-[32px] shadow-[0_0_40px_rgba(34,197,94,0.2)] transition-all hover:scale-[1.02] flex flex-col justify-between">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-black text-xs font-black rounded-full shadow-lg whitespace-nowrap">
                {t.limitedOffer}
              </div>
              <div>
                <span className="text-primary text-xs font-bold uppercase tracking-widest">{t.annual}</span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-black text-primary">€14,99</span>
                  <span className="text-primary/60 font-medium">{t.oneTime}</span>
                </div>
                <p className="mt-2 text-primary font-bold text-sm">{t.limitedOfferDesc}</p>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-center gap-3 text-white"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Acesso vitalício (Sem mensalidade)" : "Lifetime access (No monthly fee)"}</li>
                  <li className="flex items-center gap-3 text-white"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Dashboard Exclusivo" : "Exclusive Dashboard"}</li>
                  <li className="flex items-center gap-3 text-white"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Relatório de Gastos Avançado" : "Advanced Expense Report"}</li>
                  <li className="flex items-center gap-3 text-white"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Sugestões de Gestão via IA" : "AI Management Suggestions"}</li>
                  <li className="flex items-center gap-3 text-white"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Metas de Economia" : "Savings Goals"}</li>
                  <li className="flex items-center gap-3 text-white"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Exportação de Dados (CSV/PDF)" : "Data Export (CSV/PDF)"}</li>
                  <li className="flex items-center gap-3 text-white"><CheckCircle2 className="w-5 h-5 text-primary" /> {isBrazil ? "Suporte VIP 24/7" : "VIP 24/7 Support"}</li>
                </ul>
              </div>
              <button className="mt-12 w-full py-4 bg-primary text-black font-black rounded-2xl hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all">
                {t.selectPlan}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section id="preview" className="py-20 px-6 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-20 py-20">
             <div className="flex-1 scale-110">
                <img src="/assets/dashboard_preview_1.png" alt="Dashboard Chart" className="rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10" />
             </div>
             <div className="flex-1 space-y-8">
                <h2 className="text-4xl font-bold leading-tight">{t.manageFinancesTitle}</h2>
                <p className="text-gray-400 leading-relaxed">{t.manageFinancesDesc}</p>
                <button className="px-8 py-4 bg-primary text-black font-bold rounded-full hover:scale-105 transition-transform">{t.learnMore}</button>
             </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12">
          <div className="max-w-xs">
             <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-black font-bold">P</span>
                </div>
                <span className="text-xl font-bold tracking-tighter uppercase">Penny</span>
             </div>
             <p className="text-sm text-gray-500 leading-relaxed">{t.footerDesc}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
             <div><h4 className="font-bold mb-6">{isBrazil ? "Produto" : "Product"}</h4><ul className="text-sm text-gray-500 space-y-4"><li>Dashboard</li><li>{isBrazil ? "Funcionalidades" : "Features"}</li><li>{isBrazil ? "Preços" : "Pricing"}</li></ul></div>
             <div><h4 className="font-bold mb-6">{isBrazil ? "Empresa" : "Company"}</h4><ul className="text-sm text-gray-500 space-y-4"><li>{isBrazil ? "Sobre Nós" : "About Us"}</li><li>{isBrazil ? "Carreiras" : "Careers"}</li><li>{isBrazil ? "Contato" : "Contact"}</li></ul></div>
             <div><h4 className="font-bold mb-6">{isBrazil ? "Legal" : "Legal"}</h4><ul className="text-sm text-gray-500 space-y-4"><li>{isBrazil ? "Privacidade" : "Privacy"}</li><li>{isBrazil ? "Termos" : "Terms"}</li></ul></div>
          </div>
        </div>
        <div className="text-center mt-20 pt-8 border-t border-white/5 text-xs text-gray-600">
          © {new Date().getFullYear()} Penny Finance. All rights reserved.
        </div>
      </footer>
    </div>
  );

  const Dashboard = () => (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Search/Header for Mobile */}
      <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Penny</h1>
        <div className="flex items-center gap-4">
           <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
             WM
           </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 h-screen fixed bg-black border-r border-white/5 p-6 flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                <span className="text-black font-bold text-xl">P</span>
              </div>
              <span className="text-2xl font-bold">Penny</span>
            </div>
            <nav className="space-y-2">
              {[
                { name: isBrazil ? "Início" : "Home", id: "Home" },
                { name: isBrazil ? "Painel" : "Dashboard", id: "Dashboard" },
                { name: isBrazil ? "Carteiras" : "Wallets", id: "Wallets" },
                { name: isBrazil ? "Transações" : "Transactions", id: "Transactions" }
              ].map((item) => (
                <a key={item.id} href="#" className={`flex items-center px-4 py-3 rounded-xl transition-all ${item.id === 'Dashboard' ? 'bg-primary/10 text-primary font-bold' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                  {item.name}
                </a>
              ))}
            </nav>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary border border-primary/30">
                  WM
                </div>
                <div>
                  <p className="text-xs font-bold truncate max-w-[100px]">Wendel Monteiro</p>
                  <p className="text-[10px] text-gray-500">{isBrazil ? "Conta Gratuita" : "Free Account"}</p>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-4 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header Desktop */}
             <div className="hidden lg:flex items-center justify-between">
                <div>
                   <h2 className="text-3xl font-bold">{t.dashboard}</h2>
                   <p className="text-gray-500 text-sm">{t.welcome}, Wendel</p>
                </div>
                <div className="flex items-center gap-4">
                   <button 
                    onClick={handleDisarm}
                    title={t.disarm}
                    className="flex items-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-all font-bold text-sm"
                   >
                     <span>🛑</span> {t.disarm}
                   </button>
                   <div className="p-3 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">🔔</div>
                   <div className="p-3 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">⚙️</div>
                </div>
             </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cards Section */}
              <div className="lg:col-span-2 space-y-8">
                {/* Balance Card */}
                <div className="relative rounded-[32px] bg-gradient-to-br from-[#d946ef] via-[#fb7185] to-[#f97316] p-8 text-white overflow-hidden shadow-[0_20px_50px_rgba(236,72,153,0.3)] group transition-all hover:translate-y-[-2px]">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
                   <div className="relative z-10 flex flex-col justify-center min-h-[160px]">
                      <p className="text-sm font-medium opacity-90 mb-1">{t.totalSpent}</p>
                      <h3 className="text-6xl font-black tracking-tighter">{formatCurrency(balance)}</h3>
                   </div>
                </div>

                {/* Activity Chart */}
                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-md">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="font-bold text-lg">{t.activityStats}</h3>
                      <select className="bg-black border border-white/10 text-xs rounded-lg px-3 py-1 text-gray-400">
                        <option>{t.week}</option>
                        <option>{t.month}</option>
                      </select>
                   </div>
                   <div className="h-48 flex items-end justify-between gap-4">
                      {chartHeights.map((amount, i) => {
                        const percentage = Math.min((amount / MAX_CHART_THRESHOLD) * 100, 100);
                        return (
                          <div key={i} className="flex-1 group flex flex-col items-center gap-3">
                            <div className="w-full relative flex flex-col justify-end h-32">
                               <div 
                                 className="w-full bg-primary/20 rounded-lg group-hover:bg-primary/40 transition-all duration-300 relative"
                                 style={{ height: `${Math.max(percentage, amount > 0 ? 5 : 0)}%` }}
                               >
                                 <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-20 transition-opacity blur-lg"></div>
                                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-primary">
                                    {formatCurrency(amount)}
                                 </div>
                               </div>
                            </div>
                            <span className="text-[10px] text-gray-600 font-bold uppercase">{daysOfWeek[i]}</span>
                          </div>
                        );
                      })}
                   </div>
                </div>
              </div>

              {/* Sidebar Stats */}
              <div className="space-y-8">
                {/* Circular Spending */}
                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl flex flex-col items-center text-center">
                   <h3 className="font-bold mb-8">{t.spendingGoal}</h3>
                   <div className="relative w-40 h-40 mb-8">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="80" cy="80" r="70" fill="none" stroke="#222" strokeWidth="12" />
                        <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray={440} strokeDashoffset={440 - (440 * spendingPercentage) / 100} className="text-primary" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black">{spendingPercentage}%</span>
                        <span className="text-[10px] text-gray-500 uppercase">{isBrazil ? "do mês" : "of month"}</span>
                      </div>
                   </div>
                   <div className="w-full space-y-4">
                      {mainCategories.map((cat, i) => (
                        <div key={i} className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${cat.color} shadow-[0_0_8px_currentColor]`}></div>
                              <span className="text-xs text-gray-400 font-medium">{cat.name}</span>
                           </div>
                           <span className="text-xs font-bold">{formatCurrency(categoriesMap[cat.name] || 0)}</span>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              {/* Transações Full Width Bottom */}
              <div className="lg:col-span-3 p-8 bg-white/5 border border-white/10 rounded-[32px] shadow-2xl">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold tracking-tight">{t.recentTransactions}</h3>
                    <button className="text-xs text-primary font-bold hover:underline">{t.seeAll}</button>
                 </div>
                 
                 {loading ? (
                    <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div></div>
                 ) : transactions.length === 0 ? (
                    <p className="text-center text-gray-600 py-12 italic">{t.noTransactions}</p>
                 ) : (
                    <div className="space-y-4">
                       {transactions.map((tx) => {
                         const isError = tx.type === 'error';
                         const isIncome = tx.type === 'income';
                         
                         return (
                           <div key={tx.id} className={`group flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all ${isError ? 'opacity-40 grayscale' : ''}`}>
                              <div className="flex items-center gap-4">
                                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:scale-110 ${isError ? 'bg-gray-500/10 text-gray-400' : isIncome ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {isError ? '✕' : isIncome ? '↑' : '↓'}
                                 </div>
                                 <div>
                                    <p className={`text-sm font-bold ${isError ? 'line-through' : ''}`}>
                                      {isError ? (isBrazil ? "Erro Corrigido" : "Corrected Error") : (tx.description || (isBrazil ? "Transação" : "Transaction"))}
                                    </p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{formatDate(tx.date, tx.createdAt)} • {isError ? (isBrazil ? "Cancelado" : "Cancelled") : (tx.category || (isBrazil ? "Geral" : "General"))}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className={`font-black text-lg ${isError ? 'text-gray-500 line-through' : isIncome ? 'text-green-500' : 'text-red-500'}`}>
                                    {isError ? '' : isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                                 </p>
                              </div>
                           </div>
                         );
                       })}
                    </div>
                 )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );

  // --- Main Render Logic ---

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-muted p-8 rounded-3xl border border-red-500/30 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">⚠️ Configuration Error</h1>
          <p className="text-gray-400 mb-6">Environment variables are missing on Vercel.</p>
          <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20 text-xs text-orange-200 text-left">
            <h3 className="font-bold mb-2">💡 Tip:</h3>
            <ul className="space-y-1 list-disc pl-4 opacity-80">
              <li>Check VITE_FIREBASE_API_KEY</li>
              <li>Make sure Production is checked</li>
              <li>Perform a Redeploy</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!userId) {
    return <LandingPage />;
  }

  return <Dashboard />;
}

export default App;
