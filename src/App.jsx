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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuta em tempo real para as transações
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionsData = [];
      snapshot.forEach((doc) => {
        transactionsData.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(transactionsData);
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar transações:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatCurrency = (amount, currency = 'R$') => {
    return `${currency} ${parseFloat(amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Data N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // --- Cálculos Dinâmicos ---

  // 1. Totais
  const totalExpenses = transactions
    .filter((t) => t.type === 'expense' || !t.type) // Assume expense se não houver tipo (para robustez)
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const balance = totalIncome - totalExpenses;

  // 2. Porcentagem de Gastos (Orçamento base de R$ 5000)
  const budget = 5000;
  const spendingPercentage = Math.min(Math.round((totalExpenses / budget) * 100), 100);

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
    { name: 'Alimentação', color: 'bg-orange-500' },
    { name: 'Transporte', color: 'bg-blue-500' },
    { name: 'Shopping', color: 'bg-pink-500' },
    { name: 'Lazer', color: 'bg-purple-500' }
  ];

  // 4. Atividade Semanal (Últimos 7 dias)
  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dailyActivity = daysOfWeek.map((day, index) => {
    const totalDay = transactions.reduce((sum, t) => {
      const date = new Date(t.date || t.createdAt);
      if (date.getDay() === index) {
        return sum + parseFloat(t.amount || 0);
      }
      return sum;
    }, 0);
    return totalDay;
  });
  const maxDaily = Math.max(...dailyActivity, 1);
  const chartHeights = dailyActivity.map(val => (val / maxDaily) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold text-gray-900">Penny</h1>
            <nav className="hidden md:flex gap-6">
              <a href="#" className="text-gray-600 hover:text-gray-900">Início</a>
              <a href="#" className="text-orange-500 font-medium">Dashboard</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">Carteiras</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">Transações</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700">Richard Hendricks</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Cards & Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Cards - Simplified */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="relative h-48 rounded-2xl bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400 p-6 text-white overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col justify-center h-full">
                  <p className="text-sm opacity-90 mb-1">Gastos até agora.</p>
                  <p className="text-5xl font-bold">{formatCurrency(totalExpenses)}</p>
                </div>
              </div>
            </div>

            {/* Activity Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Atividade</h2>
                <select className="text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1">
                  <option>Semana</option>
                  <option>Mês</option>
                  <option>Ano</option>
                </select>
              </div>
              
              {/* Simple Activity Visualization */}
              <div className="h-48 flex items-end justify-between gap-2">
                {chartHeights.map((height, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-gradient-to-t from-purple-400 to-purple-200 rounded-lg transition-all hover:opacity-80"
                      style={{ height: `${Math.max(height, 5)}%` }}
                    ></div>
                    <span className="text-xs text-gray-500">
                      {daysOfWeek[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Stats & Progress */}
          <div className="space-y-6">
            {/* Spending Progress */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Gastos</h2>
              
              {/* Circular Progress */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-40 h-40">
                  <svg className="transform -rotate-90 w-40 h-40">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="#f3f4f6"
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="url(#gradient)"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 70}`}
                      strokeDashoffset={`${2 * Math.PI * 70 * (1 - spendingPercentage / 100)}`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-900">{spendingPercentage}%</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(balance)}</p>
                  <p className="text-sm text-gray-500">Saldo Disponível</p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-3">
                {mainCategories.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${cat.color}`}></div>
                      <span className="text-sm text-gray-600">{cat.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(categoriesMap[cat.name] || 0)}
                    </span>
                  </div>
                ))}
                {/* Outros / Dinâmico */}
                {Object.keys(categoriesMap).filter(c => !mainCategories.find(mc => mc.name === c)).map((otherCat, i) => (
                  <div key={`other-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                      <span className="text-sm text-gray-600">{otherCat}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(categoriesMap[otherCat])}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Payments & Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Transações Recentes</h2>
              <button className="text-sm text-gray-600 hover:text-gray-900">Ver Todas</button>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhuma transação encontrada</p>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 10).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        transaction.type === 'expense' || !transaction.type ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        <span className="text-lg">
                          {transaction.type === 'expense' || !transaction.type ? '↓' : '↑'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {transaction.description || 'Transação'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(transaction.date || transaction.createdAt)} • {transaction.category || 'Geral'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        transaction.type === 'expense' || !transaction.type ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {transaction.type === 'expense' || !transaction.type ? '-' : '+'}
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
