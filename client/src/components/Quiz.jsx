import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, 
  ChevronLeft,
  RefreshCw, 
  CheckCircle2, 
  Lightbulb, 
  Banknote, 
  MessageSquare, 
  Clock,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import gsap from 'gsap';
import './Quiz.css';

// Analytics Tracker Helper
const trackStep = async (stepName) => {
  try {
    const baseUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:8080' 
      : 'https://penny-finance-backend.fly.dev';
    
    console.log(`[Analytics] Tracking step: ${stepName} to ${baseUrl}`);

    const res = await fetch(`${baseUrl}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: stepName })
    });
    
    if (!res.ok) {
        console.error('[Analytics] Server responded with error:', res.status, res.statusText);
    } else {
        console.log('[Analytics] Tracked successfully');
    }
  } catch (e) {
    console.error('[Analytics] Tracking failed:', e);
  }
};

const PERSONALITY_MAP = {
  "In NQ/Spinningfields (Pints and fancy dinners).": {
    pain: "The Sunday Fear knowing you dropped £100 on a single night out.",
    desire: "Still being the legend of the group, but spending half the cash and dodging the overdraft."
  },
  "Convenience runs (Uber Eats, Pret, £4 coffees).": {
    pain: "The 'Latte Levy' - bleeding cash £4 at a time without realizing.",
    desire: "Enjoying your treats without that guilty feeling at the end of the month."
  },
  "Transport chaos (Panic Ubers and Tram fines).": {
    pain: "The frustration of burning cash on silly fines and surge pricing Ubers.",
    desire: "Getting around Manchester stress-free and keeping that cash in your pocket."
  },
  "Late night scrolling (ASOS/Amazon at 11pm).": {
    pain: "That dopamine hit at checkout followed by instant buyer's remorse.",
    desire: "Treating yourself to things you actually love, without the financial hangover."
  }
};

const REVIEWS = [
  {
    name: "Sarah Jenkins",
    location: "Ancoats, MCR",
    text: "I thought saving was impossible with my NQ nights out. Penny showed me it was the Ubers, not the pints. Recovered £150 in the first month!",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
    stars: 5
  },
  {
    name: "Mike Thompson",
    location: "Didsbury",
    text: "Never realized how much I was spending on random meal deals. This AI is brutal but brilliant. Saved £80 already.",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    stars: 5
  },
  {
    name: "Jessica Lee",
    location: "Salford Quays",
    text: "Penny paid for itself in week one just by spotting a duplicate subscription I'd totally forgotten about. Class.",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
    stars: 5
  },
  {
    name: "David Chen",
    location: "Fallowfield",
    text: "Finally an app that doesn't bore me to death. It's like having a mate check your spending. Highly recommend.",
    avatar: "https://randomuser.me/api/portraits/men/55.jpg",
    stars: 5
  },
  {
    name: "Emma Wilson",
    location: "Chorlton",
    text: "I was always afraid to check my bank balance. Penny makes it easy and actually funny. My savings are up £200.",
    avatar: "https://randomuser.me/api/portraits/women/22.jpg",
    stars: 5
  }
];

const questions = [
  {
      id: 1,
      icon: "HelpCircle",
      category: "B",
      question: "Let's be honest: Where do you feel you lost control this week?",
      options: [
          { text: "In NQ/Spinningfields (Pints and fancy dinners).", cat: "A" },
          { text: "Convenience runs (Uber Eats, Pret, £4 coffees).", cat: "B" },
          { text: "Transport chaos (Panic Ubers and Tram fines).", cat: "C" },
          { text: "Late night scrolling (ASOS/Amazon at 11pm).", cat: "B" }
      ]
  },
  {
      id: 2,
      icon: "MessageSquare",
      category: "C",
      question: "Why don't you track every penny?",
      options: [
          { text: "Banking app needs FaceID and I can't be bothered.", cat: "C" },
          { text: "Excel spreadsheets put me to sleep.", cat: "D" },
          { text: "I keep the receipt but lose it 5 mins later.", cat: "C" },
          { text: "Too scared to check the damage.", cat: "D" }
      ]
  },
  {
      id: 3,
      icon: "Banknote",
      category: "A",
      question: "What's the main excuse you tell yourself?",
      options: [
          { text: "If I pay cash, it doesn't count.", cat: "A" },
          { text: "Uber buys me time, and time is money.", cat: "C" },
          { text: "It’s an investment in my mental health.", cat: "B" },
          { text: "I'll get this round, you get the next.", cat: "A" }
      ]
  },
  {
      id: 4,
      icon: "Clock",
      category: "D",
      question: "If you had to log expenses manually, how long would you last?",
      options: [
          { text: "Wouldn't even start.", cat: "D" },
          { text: "Maybe 2 days max.", cat: "C" },
          { text: "A week, if I'm feeling ambitious.", cat: "B" },
          { text: "I could, but it’s a massive faff.", cat: "A" }
      ]
  },
  {
      id: 5,
      icon: "Zap",
      category: "A",
      question: "Imagine sending a WhatsApp message 'Spent 15 at the pub' and AI logs it all. Would you use it?",
      options: [
          { text: "YES! The only thing that would work.", cat: "A" },
          { text: "Absolutely, if it's that quick.", cat: "C" },
          { text: "Maybe, I hate opening other apps.", cat: "D" },
          { text: "Sounds too easy, but I'm listening.", cat: "B" }
      ]
  },
  {
      id: 6,
      icon: "Activity",
      category: "A",
      question: "Where will you be in 6 months without fixing this?",
      options: [
          { text: "Deep in my overdraft and stressed.", cat: "A" },
          { text: "Same as now: surviving, but skint.", cat: "B" },
          { text: "Saying goodbye to my holidays.", cat: "C" },
          { text: "Don't even make me think about it.", cat: "D" }
      ]
  },
  {
      id: 7,
      icon: "TrendingUp",
      category: "B",
      question: "Did you know? Kellanova staff saved at least £300 in two weeks using Penny.",
      options: [
          { text: "Wow, that would sort me out!", cat: "A" },
          { text: "Incredible they managed that.", cat: "C" },
          { text: "I need those savings yesterday.", cat: "D" },
          { text: "Sounds too good, but I'll give it a go.", cat: "B" }
      ]
  },
  {
      id: 8,
      id_lead: "LEAD_CAPTURE",
      icon: "ClipboardList",
      category: "D",
      question: "We've analyzed your profile. Where should we send your Personal Money Report?",
      options: [
          { text: "See my diagnosis now!", cat: "D" }
      ]
  }
];


const diagnostics = {
  A: {
      profile: "The NQ Legend",
      diagnosis: "You are the soul of the party, but your bank account is hungover. Stevenson Square and Spinningfields take 30% of your salary. The issue isn't having fun, it's not knowing the limit until you open the banking app on Sunday morning.",
      solution: "Keep being a legend, but let Penny be your financial 'designated driver'. Just WhatsApp your spend between rounds, easy."
  },
  B: {
      profile: "The Treat Lover",
      diagnosis: "'I deserve this' is your forbidden phrase. £5 coffees and impulsive Zara/Arndale trips feel harmless, but they'd pay for a Eurotrip every year. You're spending on auto-pilot.",
      solution: "Penny holds your hand before the 'tap'. It shows you how much those treats have added up this week, straight in WhatsApp, no judgement."
  },
  C: {
      profile: "The Chaotic Commuter",
      diagnosis: "Manchester rain and Metrolink are your villains. You pay the 'disorganization tax' with panic Ubers and forgotten tap-out fines. It's money flushed down the drain due to rushing.",
      solution: "You need zero friction. Hopped in an Uber? Just text 'Uber 8' to Penny on WhatsApp and forget it. Effortless organization."
  },
  D: {
      profile: "The Ostrich",
      diagnosis: "You avoid checking your balance because the truth hurts. You live on 'I hope the card works'. This lack of clarity creates a constant background anxiety.",
      solution: "Penny takes the monster from under the bed. It gives you daily clarity in a friendly way: 'You can spend £20 today'. Living with control means living without fear."
  }
};

const checklistItems = [
  "Connecting to Manchester servers...",
  "Calculating NQ inflation...",
  "Analyzing Metrolink fines...",
  "Identifying Financial Personality...",
  "Generating Personal Strategy..."
];

const Quiz = ({ onCompletePurchase }) => {
  const [phase, setPhase] = useState('welcome'); // welcome, quiz, loading, results
  const [currentIdx, setCurrentIdx] = useState(0);
  const [scores, setScores] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [userAnswers, setUserAnswers] = useState([]);
  const [firstQuestionAnswer, setFirstQuestionAnswer] = useState("");
  const [completedChecks, setCompletedChecks] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [winner, setWinner] = useState('D');
  const [timeLeft, setTimeLeft] = useState(5 * 60 * 60);

  const cardRef = useRef(null);
  const carouselRef = useRef(null); // Add ref for carousel

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

  // Tracking Start
  useEffect(() => {
    trackStep('funnel_start');
  }, []);

  const next = (cat, answerText) => {
    // Track Question Answered
    trackStep(`question_${currentIdx + 1}_answered`);

    if (scores[cat] !== undefined) {
      setScores(prev => ({ ...prev, [cat]: prev[cat] + 1 }));
    }
    if (answerText) {
      setUserAnswers(prev => [...prev, answerText]);
      if (currentIdx === 0) {
        setFirstQuestionAnswer(answerText);
      }
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

  const dynamicContent = PERSONALITY_MAP[firstQuestionAnswer] || {
    pain: diagnostics[winner]?.diagnosis || "Você sente que o dinheiro some sem explicação.",
    desire: diagnostics[winner]?.solution || "Retomar o controle total das suas finanças."
  };

  return (
    <div className={`min-h-screen flex items-center justify-center transition-all duration-1000 ${
      phase === 'quiz' ? `quiz-bg-${questions[currentIdx]?.category}` : 'quiz-bg-EDU'
    }`}>
      <div className="quiz-container">
        
        {phase === 'welcome' && (
          <div className="welcome-content quiz-glass-card text-center">
            <div className="mb-8 flex items-center justify-center gap-3">
              <img src="/penny-logo.png" alt="Penny Logo" className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="font-extrabold text-4xl text-emerald-400 tracking-tighter">Penny.</span>
            </div>
            <h1 className="text-4xl font-black mb-6 leading-tight text-white">Manchester Money Personality Test</h1>
            <p className="text-gray-400 mb-10 text-lg">Find out where your pounds are vanishing in 60 seconds.</p>
            <button 
              onClick={startQuiz}
              className="w-full py-5 bg-emerald-500 text-black font-black rounded-full text-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:scale-105 transition-transform"
            >
              START CHALLENGE
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
                QUESTION {currentIdx + 1} OF {questions.length}
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
                      <span>Who guesses</span>
                      <span className="text-red-500">£0 extra</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full">
                      <div className="h-full bg-red-500 w-[20%] rounded-full shadow-[0_0_10px_#ef4444]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span>Who tracks</span>
                      <span className="text-emerald-500">+£300/mo</span>
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
                    onClick={() => next(opt.cat, opt.text)}
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
              <div className="text-[10px] font-black text-emerald-500 tracking-[3px] mb-2">FINAL DIAGNOSIS</div>
              <h1 className="result-profile">{diagnostics[winner].profile}</h1>
            </div>

            <div className="text-gray-400 text-sm leading-relaxed mb-8">
              <p className="mb-4"><b className="text-white">The Diagnosis:</b> {dynamicContent.pain}</p>
              <p className="text-emerald-400 font-bold flex gap-2">
                <ArrowRight className="w-4 h-4 shrink-0" />
                <span><b>The Solution:</b> {dynamicContent.desire}</span>
              </p>
            </div>

            {/* Reviews Carousel (Replaces How It Works) */}
            <div className="mb-8 -mx-4 relative group">
              {/* Prev Button */}
              <button 
                onClick={() => carouselRef.current.scrollBy({ left: -320, behavior: 'smooth' })}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-md p-3 rounded-full border border-white/20 shadow-xl hover:bg-white/20 active:scale-95 transition-all z-10"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>

              <div 
                ref={carouselRef}
                className="flex overflow-x-auto snap-x gap-4 px-4 pb-4 scrollbar-hide"
              >
                {REVIEWS.map((review, i) => (
                  <div 
                    key={i} 
                    className="snap-center shrink-0 w-[300px] bg-white/10 backdrop-blur-sm border border-white/5 rounded-xl p-6 shadow-lg"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <img 
                        src={review.avatar} 
                        alt={review.name} 
                        className="w-12 h-12 rounded-full border-2 border-emerald-500/50"
                      />
                      <div>
                        <div className="font-bold text-white text-sm">{review.name}</div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">{review.location}</div>
                        <div className="text-[10px] text-yellow-400 mt-0.5">⭐⭐⭐⭐⭐</div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 italic leading-relaxed">
                      "{review.text}"
                    </p>
                  </div>
                ))}
              </div>
              
              {/* Navigation Button */}
              <button 
                onClick={() => carouselRef.current.scrollBy({ left: 320, behavior: 'smooth' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-md p-3 rounded-full border border-white/20 shadow-xl hover:bg-white/20 active:scale-95 transition-all z-10"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-2 mb-8 px-4 italic leading-relaxed">
              "We guarantee Penny pays for itself in under 5 days. If it doesn't sort your savings, we'll refund every penny. No faff."
            </p>

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
                  <span className="text-sm font-bold">De <span className="line-through text-red-500">£59.99/year</span> por £9.99/year</span>
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
                <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center justify-center opacity-60">
                   <div className="flex items-center gap-2 mb-2">
                      <img src="/penny-logo.png" alt="Penny" className="w-6 h-6 grayscale opacity-80" />
                      <span className="font-bold text-gray-500 tracking-widest text-xs">PENNY FINANCE</span>
                   </div>
                   <p className="text-[10px] text-gray-600">Secure 256-bit SSL Encryption</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Quiz;
