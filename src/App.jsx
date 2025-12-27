import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
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

function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Get User ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('user');

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // 2. Query only the specific user's transactions
    console.log(`📊 [Dashboard] Carregando dados para o usuário: ${userId}`);
    const q = query(
      collection(db, 'usuarios', userId, 'transactions'), 
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`📊 [Firestore] Recebido snapshot com ${snapshot.size} documentos`);
      const transactionsData = [];
      snapshot.forEach((doc) => {
        transactionsData.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(transactionsData);
      setLoading(false);
    }, (error) => {
      console.error('❌ [Firestore] Erro ao buscar transações:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const formatCurrency = (amount, currency = '£') => {
    return `${currency}${parseFloat(amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const parseSafeDate = (dateValue) => {
    if (!dateValue || dateValue === 'N/A') return null;
    
    // Handle Firestore Timestamp
    if (dateValue && typeof dateValue === 'object' && dateValue.seconds !== undefined) {
      return new Date(dateValue.seconds * 1000);
    }
    
    // Handle European/Brazilian DD/MM/YYYY
    if (typeof dateValue === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateValue)) {
      const [day, month, year] = dateValue.split('/');
      return new Date(year, month - 1, day);
    }

    // Handle JS Date or ISO String
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (dateValue, fallbackValue) => {
    let date = parseSafeDate(dateValue);
    if (!date && fallbackValue) date = parseSafeDate(fallbackValue);
    
    if (!date) return 'Date N/A';
    
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // --- Cálculos Dinâmicos ---

  // 1. Totais
  const totalExpenses = transactions
    .filter((t) => t.type !== 'income') // Tudo que não é explicitamente 'income' entra como gasto
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const balance = totalIncome - totalExpenses;

  // 2. Porcentagem de Gastos (1% por transação, limitado a 100%)
  const spendingPercentage = Math.min(transactions.length, 100);

  // 3. Agrupamento por Categorias Dinâmico
  const categoriesMap = transactions
    .filter(t => t.type === 'expense' || !t.type)
    .reduce((acc, t) => {
      const cat = t.category || 'Outros';
      acc[cat] = (acc[cat] || 0) + parseFloat(t.amount || 0);
      return acc;
    }, {});

  // Categorias principais para exibir no dashboard (mesmo que vazias)
  const mainCategories = [
    { name: 'Food', color: 'bg-orange-500' },
    { name: 'Transport', color: 'bg-blue-500' },
    { name: 'Shopping', color: 'bg-pink-500' },
    { name: 'Leisure', color: 'bg-purple-500' }
  ];

  // 4. Atividade Semanal (Volume de transações por dia)
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyActivity = daysOfWeek.map((day, index) => {
    // Sum transaction amounts per day (only for expenses/untyped)
    const totalAmount = transactions
      .filter((t) => {
        const date = parseSafeDate(t.date) || parseSafeDate(t.createdAt);
        return date && date.getDay() === index && (t.type === 'expense' || !t.type);
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
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#preview" className="hover:text-white transition-colors">Preview</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          </div>
          <button className="px-5 py-2 bg-primary text-black text-sm font-bold rounded-full hover:scale-105 transition-transform">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Let's manage your <span className="text-primary italic">finances</span> now, to make the future easier
            </h1>
            <p className="text-xl text-gray-400 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
              Penny is your automated financial companion. Just text your expenses on WhatsApp, and we'll do the magic. No apps to download, no friction.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button className="w-full sm:w-auto px-8 py-4 bg-primary text-black font-bold rounded-full hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all">
                Get Started
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
                Introduction
              </button>
            </div>
            <div className="mt-12 flex items-center justify-center lg:justify-start gap-8">
              <div><p className="text-2xl font-bold">25k+</p><p className="text-xs text-gray-500 uppercase tracking-widest">Happy Customers</p></div>
              <div className="w-px h-8 bg-white/10"></div>
              <div><p className="text-2xl font-bold">11+</p><p className="text-xs text-gray-500 uppercase tracking-widest">Years of exp</p></div>
              <div className="w-px h-8 bg-white/10"></div>
              <div><p className="text-2xl font-bold">20</p><p className="text-xs text-gray-500 uppercase tracking-widest">Countries</p></div>
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="relative z-10 p-4 bg-white/5 border border-white/10 rounded-[40px] shadow-2xl overflow-hidden backdrop-blur-3xl">
              <img 
                src="/assets/hero_dashboard.png" 
                alt="Penny Dashboard Preview" 
                className="rounded-[32px] w-full shadow-2xl hover:scale-[1.02] transition-transform duration-700"
              />
            </div>
            {/* Background blobs */}
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-primary/20 blur-[80px] rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Brands */}
      <div className="max-w-7xl mx-auto px-6 py-12 border-y border-white/5 flex flex-wrap items-center justify-around gap-8 opacity-40 grayscale hover:grayscale-0 transition-all">
        <span className="text-2xl font-bold tracking-tighter italic">slack</span>
        <span className="text-2xl font-bold tracking-tighter italic">Dropbox</span>
        <span className="text-2xl font-bold tracking-tighter italic">VISA</span>
        <span className="text-2xl font-bold tracking-tighter italic">Wise</span>
      </div>

      {/* Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">We are a platform with the <br/> most complete features</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Guaranteed safety', desc: 'All forms of transactions and information about your finances are 100% protected.', icon: '🛡️' },
              { title: 'Saving global payments', desc: 'Penny is present in 20 countries, this makes us provide payment features globally.', icon: '🌐' },
              { title: 'Verified Platform', desc: 'Penny is a verified payment platform according to government regulations.', icon: '✅' }
            ].map((f, i) => (
              <div key={i} className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors group">
                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-4">{f.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
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
                <h2 className="text-4xl font-bold leading-tight">We help you to manage your finances neatly and clearly</h2>
                <p className="text-gray-400 leading-relaxed">All forms of your transactions will be summarized in statistics and expense details. For use in your detailed financial report.</p>
                <button className="px-8 py-4 bg-primary text-black font-bold rounded-full hover:scale-105 transition-transform">Learn more</button>
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
             <p className="text-sm text-gray-500 leading-relaxed">The easiest way to track your money, right from your WhatsApp.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
             <div><h4 className="font-bold mb-6">Product</h4><ul className="text-sm text-gray-500 space-y-4"><li>Dashboard</li><li>Features</li><li>Pricing</li></ul></div>
             <div><h4 className="font-bold mb-6">Company</h4><ul className="text-sm text-gray-500 space-y-4"><li>About Us</li><li>Careers</li><li>Contact</li></ul></div>
             <div><h4 className="font-bold mb-6">Legal</h4><ul className="text-sm text-gray-500 space-y-4"><li>Privacy</li><li>Terms</li></ul></div>
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
              {['Home', 'Dashboard', 'Wallets', 'Transactions'].map((item) => (
                <a key={item} href="#" className={`flex items-center px-4 py-3 rounded-xl transition-all ${item === 'Dashboard' ? 'bg-primary/10 text-primary font-bold' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                  {item}
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
                  <p className="text-[10px] text-gray-500">Free Account</p>
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
                  <h2 className="text-3xl font-bold">Dashboard</h2>
                  <p className="text-gray-500 text-sm">Welcome back, Wendel</p>
               </div>
               <div className="flex items-center gap-4">
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
                      <p className="text-sm font-medium opacity-90 mb-1">Total spent to date.</p>
                      <h3 className="text-6xl font-black tracking-tighter">{formatCurrency(totalExpenses)}</h3>
                   </div>
                </div>

                {/* Activity Chart */}
                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-md">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="font-bold text-lg">Activity Statistics</h3>
                      <select className="bg-black border border-white/10 text-xs rounded-lg px-3 py-1 text-gray-400">
                        <option>Week</option>
                        <option>Month</option>
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
                   <h3 className="font-bold mb-8">Spending Goal</h3>
                   <div className="relative w-40 h-40 mb-8">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="80" cy="80" r="70" fill="none" stroke="#222" strokeWidth="12" />
                        <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray={440} strokeDashoffset={440 - (440 * spendingPercentage) / 100} className="text-primary" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black">{spendingPercentage}%</span>
                        <span className="text-[10px] text-gray-500 uppercase">of month</span>
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
                    <h3 className="text-xl font-bold tracking-tight">Recent Transactions</h3>
                    <button className="text-xs text-primary font-bold hover:underline">See All</button>
                 </div>
                 
                 {loading ? (
                    <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div></div>
                 ) : transactions.length === 0 ? (
                    <p className="text-center text-gray-600 py-12 italic">No transactions recorded yet.</p>
                 ) : (
                    <div className="space-y-4">
                       {transactions.map((t) => (
                         <div key={t.id} className="group flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all">
                            <div className="flex items-center gap-4">
                               <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:scale-110 ${t.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                  {t.type === 'income' ? '↑' : '↓'}
                               </div>
                               <div>
                                  <p className="text-sm font-bold">{t.description || 'Transaction'}</p>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{formatDate(t.date, t.createdAt)} • {t.category || 'General'}</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className={`font-black text-lg ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                               </p>
                            </div>
                         </div>
                       ))}
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
