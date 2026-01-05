import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, 
  RefreshCw, 
  CheckCircle2, 
  Lightbulb, 
  Banknote, 
  MessageSquare, 
  Clock,
  ArrowRight
} from 'lucide-react';
import gsap from 'gsap';
import './Quiz.css';

const questions = [
  {
      id: 1,
      icon: "Sunrise",
      category: "C",
      question: "Vamos começar com a sua manhã. O despertador toca, você está atrasado. O que acontece?",
      options: [
          { text: "Chamo um Uber. Não vou encarar a chuva até o ponto de ônibus.", cat: "C" },
          { text: "Paro no Pret ou Starbucks. Preciso de um café de £4 para funcionar.", cat: "B" },
          { text: "Corro para o trabalho em pânico, nem tomo café.", cat: "D" },
          { text: "Estou de ressaca de ontem à noite, só quero sobreviver.", cat: "A" }
      ]
  },
  {
      id: 2,
      icon: "UtensilsCrossed",
      category: "D",
      question: "Chegou a hora do almoço no escritório. Qual é o plano?",
      options: [
          { text: "Trouxe marmita, mas esqueci em casa e comprei um Tesco Meal Deal.", cat: "D" },
          { text: "Pub lunch com a equipe! Um hambúrguer e talvez uma pint rápida.", cat: "A" },
          { text: "Vou dar uma volta no Arndale... acabo comprando 'só uma coisinha'.", cat: "B" },
          { text: "Peço um Deliveroo/Uber Eats direto na mesa.", cat: "C" }
      ]
  },
  {
      id: 3,
      icon: "Moon",
      category: "A",
      question: "Sexta-feira à noite em Manchester. Onde é mais provável te encontrar?",
      options: [
          { text: "Northern Quarter ou Spinningfields. Rodadas de drinks até o fim.", cat: "A" },
          { text: "Em casa, assistindo Netflix, mas pedindo um delivery caro.", cat: "D" },
          { text: "Tentando voltar pra casa, mas o Metrolink tá quebrado (Uber de novo).", cat: "C" },
          { text: "Navegando na ASOS ou Amazon com um vinho na mão.", cat: "B" }
      ]
  },
  {
      id: 4,
      icon: "TramFront",
      category: "C",
      question: "Seja honesto: Quantas vezes este mês você esqueceu de fazer o 'Touch-out' no Metrolink?",
      options: [
          { text: "Pelo menos umas duas vezes. Aqueles £4.60 doem.", cat: "C" },
          { text: "Eu não pego Metrolink, só ando de Uber ou Táxi.", cat: "A" },
          { text: "Eu nem olho, vai ver já me cobraram e eu não vi.", cat: "B" },
          { text: "Eu ando a pé ou de bicicleta (quando não chove).", cat: "D" }
      ]
  },
  {
      id: 5,
      icon: "Calculator",
      category: "B",
      question: "'Girl Math' (ou Lógica de Bar): Qual frase você mais usa para justificar um gasto?",
      options: [
          { text: "'Se eu pagar em dinheiro vivo, é como se fosse de graça.'", cat: "B" },
          { text: "'Eu pago essa rodada, você paga a próxima' (a conta nunca fecha).", cat: "A" },
          { text: "'Se eu pegar um Uber agora, ganho 20 min de sono. Tempo é dinheiro!'", cat: "C" },
          { text: "'Eu mereço, trabalhei muito essa semana.'", cat: "D" }
      ]
  },
  {
      id: "EDU_1",
      icon: "GraduationCap",
      category: "EDU",
      question: "Você sabia que um estudo de Harvard mostrou que pessoas que sabem exatamente quanto gastam por dia...",
      isChart: true,
      subtext: "...terminam o mês com, em média, £300 a mais no bolso?",
      options: [
          { text: "🤯 Caramba, £300 pagam meu aluguel de vida social!", cat: "D" },
          { text: "📉 Eu definitivamente estou no grupo que perde dinheiro.", cat: "D" },
          { text: "🤔 Faz sentido, mas anotar dá trabalho.", cat: "D" }
      ]
  },
  {
      id: "EDU_2",
      icon: "HelpCircle",
      category: "EDU",
      question: "Falando nisso... Qual é o maior motivo para você não anotar tudo hoje?",
      options: [
          { text: "Planilhas de Excel são chatas e feias.", cat: "C" },
          { text: "Tenho preguiça de abrir o app do banco toda hora.", cat: "C" },
          { text: "Eu esqueço de pegar a notinha fiscal.", cat: "B" },
          { text: "Eu tenho medo de ver o valor total (Avestruz).", cat: "D" }
      ]
  },
  {
      id: "HERO",
      icon: "Zap",
      category: "D",
      question: "E se você tivesse um contato no WhatsApp que você só diz: 'Gastei 15 no NQ' e ele faz tudo por você?",
      options: [
          { text: "✅ Sim! Eu vivo no WhatsApp mesmo.", cat: "SIM" },
          { text: "✅ Seria um sonho, odeio apps complicados.", cat: "SIM" },
          { text: "✅ Talvez, se for fácil assim mesmo.", cat: "SIM" }
      ]
  },
  {
      id: 6,
      icon: "Landmark",
      category: "D",
      question: "Qual é a sua relação com o aplicativo do seu banco (Monzo, Lloyds, etc)?",
      options: [
          { text: "Eu evito abrir. O que os olhos não veem, o coração não sente.", cat: "D" },
          { text: "Eu abro, vejo um monte de gastos de transporte e choro.", cat: "C" },
          { text: "Eu abro domingo de manhã e tenho um mini ataque cardíaco.", cat: "A" },
          { text: "Eu tenho notificações ativadas, mas ignoro todas.", cat: "B" }
      ]
  },
  {
      id: 7,
      icon: "Coffee",
      category: "B",
      question: "Você vê um café e um doce chique na Pollen Bakery em Ancoats. Custa £12. Você compra?",
      options: [
          { text: "Claro! É pela experiência (e pela foto no Instagram).", cat: "B" },
          { text: "Só se for num encontro ou com amigos.", cat: "A" },
          { text: "Compro, mas sinto culpa logo depois de comer.", cat: "D" },
          { text: "Não, prefiro gastar isso para chegar em casa seco.", cat: "C" }
      ]
  },
  {
      id: 8,
      icon: "ClipboardList",
      category: "D",
      question: "O pior de controlar gastos é...",
      options: [
          { text: "Ter que parar a diversão no bar para anotar.", cat: "A" },
          { text: "Ter que guardar notinhas de papel que eu sempre perco.", cat: "B" },
          { text: "Ter que abrir planilhas chatas no Excel cansado.", cat: "C" },
          { text: "Ter que categorizar cada comprinha no app do banco.", cat: "D" }
      ]
  },
  {
      id: 10,
      icon: "Wallet",
      category: "D",
      question: "Quanto você acha que gasta com 'Bobeiras' (Mimos, Taxas, Bebidas) por mês?",
      options: [
          { text: "Menos de £50.", cat: "D" },
          { text: "Entre £50 - £150.", cat: "B" },
          { text: "Mais de £200 (Sou honesto).", cat: "A" },
          { text: "Não faço a menor ideia.", cat: "C" }
      ]
  },
  {
      id: 11,
      icon: "Plane",
      category: "B",
      question: "Qual é a sua meta financeira atual (que você nunca consegue bater)?",
      options: [
          { text: "Guardar dinheiro para viajar no verão.", cat: "B" },
          { text: "Parar de entrar no Cheque Especial (Overdraft).", cat: "D" },
          { text: "Pagar o cartão de crédito de vez.", cat: "A" },
          { text: "Começar a investir de verdade.", cat: "D" }
      ]
  },
  {
      id: 12,
      icon: "Activity",
      category: "C",
      question: "Para finalizar: Qual seu nível de estresse atual com dinheiro?",
      options: [
          { text: "Zen. (Trabalhado no Yoga)", cat: "D" },
          { text: "Médio. Às vezes aperta.", cat: "B" },
          { text: "Alto. Sinto que trabalho só para pagar o Metrolink e Uber.", cat: "C" },
          { text: "Explosivo. Prefiro nem olhar o saldo.", cat: "A" }
      ]
  }
];

const diagnostics = {
  A: {
      profile: "The NQ Legend",
      diagnosis: "Você é a alma da festa, mas sua conta está de ressaca. Stevenson Square e Spinningfields levam 30% do seu salário. O problema não é se divertir, é não saber o limite até abrir o app no domingo.",
      solution: "Continue sendo a lenda, mas deixe o Penny ser seu 'designated driver' financeiro. Mande o gasto no WhatsApp entre um gole e outro."
  },
  B: {
      profile: "The Treat Lover",
      diagnosis: "'Eu mereço' é sua frase proibida. Cafés de £5 e compras impulsivas na Zara/Arndale parecem inofensivos, mas pagariam uma Eurotrip por ano. Você gasta no automático.",
      solution: "O Penny segura sua mão antes do 'tap'. Ele te mostra quanto os mimos já somaram na semana, direto no seu WhatsApp, sem julgamentos."
  },
  C: {
      profile: "The Chaotic Commuter",
      diagnosis: "A chuva de Manchester e o Metrolink são seus vilões. Você paga o 'imposto da desorganização' com Ubers de última hora e multas por esquecer o tap-out. É dinheiro jogado no ralo por pressa.",
      solution: "Você precisa de zero atrito. Entrou no Uber? Só digita 'Uber 8' pro Penny no WhatsApp e esquece. Organização sem esforço."
  },
  D: {
      profile: "The Ostrich (Avestruz)",
      diagnosis: "Você evita olhar o saldo porque a verdade dói. Vive no 'espero que o cartão passe'. Essa falta de clareza gera uma ansiedade constante que você tenta ignorar.",
      solution: "O Penny tira o monstro debaixo da cama. Ele te dá clareza diária de forma amigável: 'Você pode gastar £20 hoje'. Viver com controle é viver sem medo."
  }
};

const checklistItems = [
  "Conectando aos servidores em Manchester...",
  "Calculando inflação do Northern Quarter...",
  "Analizando multas do Metrolink...",
  "Identificando seu Perfil Financeiro...",
  "Gerando Estratégia Personalizada..."
];

const Quiz = ({ onCompletePurchase }) => {
  const [phase, setPhase] = useState('welcome'); // welcome, quiz, loading, results
  const [currentIdx, setCurrentIdx] = useState(0);
  const [scores, setScores] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [completedChecks, setCompletedChecks] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [winner, setWinner] = useState('D');
  const [timeLeft, setTimeLeft] = useState(5 * 60 * 60);

  const cardRef = useRef(null);

  // Timer logic
  useEffect(() => {
    if (phase === 'results') {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const startQuiz = () => {
    gsap.to('.welcome-content', { opacity: 0, y: -20, duration: 0.4, onComplete: () => setPhase('quiz') });
  };

  const next = (cat) => {
    if (scores[cat] !== undefined) {
      setScores(prev => ({ ...prev, [cat]: prev[cat] + 1 }));
    }

    if (currentIdx < questions.length - 1) {
      gsap.to(cardRef.current, { x: -20, opacity: 0, duration: 0.3, onComplete: () => {
        setCurrentIdx(prev => prev + 1);
        gsap.fromTo(cardRef.current, { x: 20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 });
      }});
    } else {
      gsap.to(cardRef.current, { opacity: 0, duration: 0.4, onComplete: startHackerLoading });
    }
  };

  const startHackerLoading = () => {
    setPhase('loading');
    let i = 0;
    const interval = setInterval(() => {
      if (i < checklistItems.length) {
        const item = checklistItems[i];
        setCompletedChecks(prev => [...prev, { text: item, done: false }]);
        
        const currentItemIdx = i;
        setTimeout(() => {
          setCompletedChecks(prev => {
            const nextChecks = [...prev];
            if (nextChecks[currentItemIdx]) nextChecks[currentItemIdx].done = true;
            return nextChecks;
          });
        }, 1200);

        setLoadingProgress(((i + 1) / checklistItems.length) * 100);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(showResult, 2000);
      }
    }, 1500);
  };

  const showResult = () => {
    let best = 'D';
    let max = -1;
    for (let c in scores) {
      if (scores[c] > max) {
        max = scores[c];
        best = c;
      }
    }
    setWinner(best);
    setPhase('results');
  };

  const DynamicIcon = ({ name }) => {
    const icons = {
      Sunrise: <RefreshCw className="icon-main" />, // Map properly if missing
      UtensilsCrossed: <RefreshCw className="icon-main" />,
      Moon: <Clock className="icon-main" />,
      TramFront: <RefreshCw className="icon-main" />,
      Calculator: <Clock className="icon-main" />,
      GraduationCap: <Lightbulb className="icon-main" />,
      HelpCircle: <Lightbulb className="icon-main" />,
      Zap: <Lightbulb className="icon-main" />,
      Landmark: <Banknote className="icon-main" />,
      Coffee: <RefreshCw className="icon-main" />,
      ClipboardList: <MessageSquare className="icon-main" />,
      Wallet: <Banknote className="icon-main" />,
      Plane: <RefreshCw className="icon-main" />,
      Activity: <Clock className="icon-main" />
    };
    return icons[name] || <RefreshCw className="icon-main" />;
  };

  return (
    <div className={`min-h-screen flex items-center justify-center transition-all duration-1000 ${
      phase === 'quiz' ? `quiz-bg-${questions[currentIdx]?.category}` : 'quiz-bg-EDU'
    }`}>
      <div className="quiz-container">
        
        {phase === 'welcome' && (
          <div className="welcome-content quiz-glass-card text-center">
            <div className="mb-8">
              <span className="font-extrabold text-2xl text-emerald-400">Penny.</span>
            </div>
            <h1 className="text-4xl font-black mb-6 leading-tight text-white">Manchester Money Personality Test</h1>
            <p className="text-gray-400 mb-10 text-lg">Descubra para onde suas libras estão fugindo em 60 segundos.</p>
            <button 
              onClick={startQuiz}
              className="w-full py-5 bg-emerald-500 text-black font-black rounded-full text-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:scale-105 transition-transform"
            >
              COMEÇAR O DESAFIO
            </button>
          </div>
        )}

        {phase === 'quiz' && (
          <div className="space-y-6">
            <div className="px-4">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 shadow-[0_0_15px_#10b981] transition-all duration-500"
                  style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                />
              </div>
              <span className="block mt-4 text-[10px] font-bold text-gray-500 uppercase tracking-[2px]">
                PERGUNTA {currentIdx + 1} DE {questions.length}
              </span>
            </div>

            <div ref={cardRef} className="quiz-glass-card">
              <div className="mb-6">
                <DynamicIcon name={questions[currentIdx].icon} />
              </div>
              <h2 className="text-2xl font-bold mb-8 text-white leading-snug">
                {questions[currentIdx].question}
              </h2>

              {questions[currentIdx].isChart && (
                <div className="mb-8 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span>Quem chuta</span>
                      <span className="text-red-500">£0 extras</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full">
                      <div className="h-full bg-red-500 w-[20%] rounded-full shadow-[0_0_10px_#ef4444]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span>Quem anota</span>
                      <span className="text-emerald-500">+£300/mês</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full">
                      <div className="h-full bg-emerald-500 w-[95%] rounded-full shadow-[0_0_10px_#10b981]" />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-3">
                {questions[currentIdx].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => next(opt.cat)}
                    className="option-btn"
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="quiz-glass-card">
            <div className="hacker-title">STATUS: SYSTEM_ANALYSIS_INIT</div>
            <ul className="space-y-4 font-mono">
              {completedChecks.map((check, i) => (
                <li key={i} className={`flex items-center gap-3 text-sm ${check.done ? 'text-white' : 'text-gray-500'}`}>
                  {check.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{check.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 h-0.5 bg-white/10">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'results' && (
          <div className="quiz-glass-card">
            <div className="text-center mb-8">
              <div className="text-[10px] font-black text-emerald-500 tracking-[3px] mb-2">DIAGNÓSTICO FINAL</div>
              <h1 className="result-profile">{diagnostics[winner].profile}</h1>
            </div>

            <div className="text-gray-400 text-sm leading-relaxed mb-8">
              <p className="mb-4"><b className="text-white">O Diagnóstico:</b> {diagnostics[winner].diagnosis}</p>
              <p className="text-emerald-400 font-bold flex gap-2">
                <ArrowRight className="w-4 h-4 shrink-0" />
                <span><b>A Solução:</b> {diagnostics[winner].solution}</span>
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
              <h3 className="text-sm font-black text-center mb-6">How It Works</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center"><Banknote className="w-5 h-5" /></div>
                   <div><p className="text-xs font-bold">You Spend</p><p className="text-[10px] text-gray-500">Coffee, beer or shop.</p></div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center"><MessageSquare className="w-5 h-5" /></div>
                   <div><p className="text-xs font-bold">You Text</p><p className="text-[10px] text-gray-500">Tell Penny: "Spent £15"</p></div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
                   <div><p className="text-xs font-bold">Done</p><p className="text-[10px] text-gray-500">Penny does the rest.</p></div>
                </div>
              </div>
            </div>

            <div className="power-offer-card">
              <div className="bg-white/5 p-4 text-center border-b border-white/5">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-3">Exclusive Manchester Offer Unlocked</p>
                <div className="bg-black/40 rounded-full px-4 py-2 flex items-center gap-2 w-fit mx-auto">
                  <span className="text-[10px] text-gray-500">Valid for:</span>
                  <span className="timer-clock text-xs font-bold">{formatTime(timeLeft)}</span>
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-xs font-black mb-4">What you get for the price of a pint:</h4>
                <ul className="space-y-2">
                  {['Unlimited Messages & Tracking', 'Real-time WhatsApp Dashboard', 'Smart Auto-Categorization (AI)', 'Priority Support 24/7'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-[10px] font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-black/20 text-center">
                <div className="mb-4">
                  <span className="text-xs text-gray-500 line-through mr-2">£59.99/year</span>
                  <span className="text-sm font-bold">£9.99 / YEAR</span>
                </div>
                <div className="text-2xl font-black mb-1">That's just <span className="text-yellow-400 shadow-yellow-400">3 pence</span> a day.</div>
                <p className="text-[9px] italic text-gray-500 mb-6">Literally less than a single grape.</p>
                
                <button 
                  onClick={onCompletePurchase}
                  className="pulse-bt w-full py-4 bg-emerald-500 text-black font-black rounded-full text-xs"
                >
                  UNLOCK FULL YEAR ACCESS FOR £9.99 👉
                </button>
                <p className="mt-3 text-[8px] text-gray-600 uppercase tracking-widest">No monthly fees. One-time payment.</p>
              </div>

              <div className="bg-emerald-500/10 p-4 flex gap-3 border-t border-emerald-500/20">
                <Lightbulb className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-[9px] leading-relaxed text-gray-300">
                  Think about it: If Penny saves you from just ONE impulse Uber or ONE forgotten subscription, it has already paid for itself.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Quiz;
