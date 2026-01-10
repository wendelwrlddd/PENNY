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

const questions = [
    {
        id: 1,
        icon: "help-circle",
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
        icon: "message-square",
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
        icon: "banknote",
        category: "D",
        question: "What's the main excuse you tell yourself?",
        options: [
            { text: "If I pay cash, it doesn't count.", cat: "D" },
            { text: "Uber buys me time, and time is money.", cat: "C" },
            { text: "It’s an investment in my mental health.", cat: "B" },
            { text: "I'll get this round, you get the next.", cat: "A" }
        ]
    },
    {
        id: 4,
        icon: "clock",
        category: "D",
        question: "If you had to log expenses manually, how long would you last?",
        options: [
            { text: "Wouldn't even start.", cat: "D" },
            { text: "Maybe 2 days max.", cat: "B" },
            { text: "A week, if I'm feeling ambitious.", cat: "C" },
            { text: "I could, but it’s a massive faff.", cat: "A" }
        ]
    },
    {
        id: 5,
        icon: "zap",
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
        icon: "activity",
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
        icon: "trending-up",
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
        icon: "clipboard-list",
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

// Connect to Backend (Fly.io)
const socket = io('https://penny-finance-backend.fly.dev', {
    query: { role: 'quiz_user' }
});

// Analytics Tracker Helper
const trackStep = async (stepName) => {
  try {
    const baseUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:8080' 
      : 'https://penny-finance-backend.fly.dev';
      
    console.log(`[Analytics] Tracking step: ${stepName} to ${baseUrl}`);

    await fetch(`${baseUrl}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: stepName })
    });
  } catch (e) {
    console.warn('Tracking failed', e);
  }
};

let currentIdx = 0;
let scores = { A: 0, B: 0, C: 0, D: 0 };
let firstQuestionAnswer = "";

// Elements
const screenWelcome = document.getElementById('screen-welcome');
const screenQuiz = document.getElementById('screen-quiz');
const screenLoading = document.getElementById('screen-loading');
const screenResult = document.getElementById('screen-result');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const questionLucide = document.getElementById('question-lucide');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const chartArea = document.getElementById('chart-area');

// Initial Lucide call
lucide.createIcons();

// Start
document.getElementById('start-btn').addEventListener('click', () => {
    transition(screenWelcome, screenQuiz);
    showQuestion();
    trackStep('funnel_start');
});

function transition(from, to) {
    gsap.to(from, { x: -50, opacity: 0, duration: 0.4, onComplete: () => {
        from.classList.remove('active');
        to.classList.add('active');
        gsap.fromTo(to, { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5 });
    }});
}

function showQuestion() {
    const q = questions[currentIdx];
    
    // Background dynamic switch
    document.body.className = `cat-${q.category}`;

    // Header update
    const progress = ((currentIdx + 1) / questions.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `PERGUNTA ${currentIdx + 1} DE ${questions.length}`;

    // Fix Question Icon Rendering (Lucide)
    const iconWrapper = document.getElementById('question-icon-wrapper');
    iconWrapper.innerHTML = `<i data-lucide="${q.icon}" class="icon-main"></i>`;
    lucide.createIcons(); // This replaces the <i> tag with the new SVG
    
    questionText.textContent = q.question;
    
    // Handle chart visibility
    if (q.isChart) {
        chartArea.style.display = 'flex';
        gsap.fromTo('#bar-red', { width: "0%" }, { width: "20%", duration: 1.5, delay: 0.5 });
        gsap.fromTo('#bar-green', { width: "0%" }, { width: "95%", duration: 1.5, delay: 0.8 });
    } else {
        chartArea.style.display = 'none';
    }

    // Render options
    optionsContainer.innerHTML = '';
    const btns = q.options.map((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt.text;
        btn.style.opacity = '0';
        btn.addEventListener('click', () => next(opt.cat, opt.text));
        optionsContainer.appendChild(btn);
        return btn;
    });

    gsap.to(btns, { opacity: 1, x: 0, stagger: 0.1, duration: 0.4, delay: 0.2 });
}

function next(cat, answerText) {
    trackStep(`question_${currentIdx + 1}_answered`);
    if (scores[cat] !== undefined) scores[cat]++;
    
    // Capture first answer for personalization
    if (currentIdx === 0 && answerText) {
        firstQuestionAnswer = answerText;
    }
    
    if (currentIdx < questions.length - 1) {
        gsap.to('#quiz-card', { x: -20, opacity: 0, duration: 0.3, onComplete: () => {
            currentIdx++;
            showQuestion();
            gsap.fromTo('#quiz-card', { x: 20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 });
        }});
    } else {
        startHackerLoading();
    }
}

function startHackerLoading() {
    transition(screenQuiz, screenLoading);
    const checklist = document.getElementById('checklist');
    const loader = document.getElementById('hacker-loader');
    
    checklist.innerHTML = '';
    let i = 0;

    const interval = setInterval(() => {
        if (i < checklistItems.length) {
            const li = document.createElement('li');
            li.className = 'check-item';
            li.innerHTML = `<span class="check-icon"><i data-lucide="refresh-cw" class="spin-icon"></i></span> <span>${checklistItems[i]}</span>`;
            checklist.appendChild(li);
            lucide.createIcons();
            
            // Animation for item
            gsap.from(li, { opacity: 0, x: -10, duration: 0.3 });

            // Set "Done" after delay
            setTimeout(() => {
                li.querySelector('.check-icon').innerHTML = '<i data-lucide="check-circle-2" style="color:var(--penny-green)"></i>';
                lucide.createIcons();
                li.classList.add('done');
            }, 1200);

            // Update global loader
            gsap.to(loader, { width: `${((i + 1) / checklistItems.length) * 100}%`, duration: 1 });

            i++;
        } else {
            clearInterval(interval);
            setTimeout(showResult, 1500);
        }
    }, 1500);
}

function startTimer() {
    let timeLeft = 5 * 60 * 60; // 5 hours in seconds
    const timerDisplay = document.getElementById('offer-timer');
    
    const timerInterval = setInterval(() => {
        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        const seconds = timeLeft % 60;
        
        timerDisplay.textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
        }
        timeLeft--;
    }, 1000);
}

function showResult() {
    trackStep('funnel_completed');
    let winner = 'D';
    let max = -1;
    for (let c in scores) {
        if (scores[c] > max) { max = scores[c]; winner = c; }
    }

    const res = diagnostics[winner];
    const dynamicContent = PERSONALITY_MAP[firstQuestionAnswer] || {
        pain: res.diagnosis,
        desire: res.solution
    };

    document.getElementById('result-profile').textContent = res.profile;
    document.getElementById('result-text').innerHTML = `
        <p><b>The Diagnosis:</b> ${dynamicContent.pain}</p>
        <p style="color: var(--penny-green); font-weight: 600; margin-top: 15px;">🚀 <b>The Solution:</b> ${dynamicContent.desire}</p>
    `;

    transition(screenLoading, screenResult);
    startTimer();
    
    // Initialize Carousel Logic
    setTimeout(() => {
        const carousel = document.querySelector('.reviews-carousel');
        const nextBtn = document.getElementById('carousel-next-btn');
        const prevBtn = document.getElementById('carousel-prev-btn');
        
        if (carousel) {
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    carousel.scrollBy({ left: 320, behavior: 'smooth' });
                });
            }
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    carousel.scrollBy({ left: -320, behavior: 'smooth' });
                });
            }
        }
    }, 500);
}
