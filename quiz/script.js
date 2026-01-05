const questions = [
    {
        id: 1,
        icon: "sunrise",
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
        icon: "utensils-cross-lines",
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
        icon: "moon",
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
        icon: "tram-front",
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
        icon: "calculator",
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
        icon: "graduation-cap",
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
        icon: "help-circle",
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
        icon: "zap",
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
        icon: "landmark",
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
        icon: "coffee",
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
        icon: "clipboard-list",
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
        icon: "wallet",
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
        icon: "plane-takeoff",
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
        icon: "activity",
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

let currentIdx = 0;
let scores = { A: 0, B: 0, C: 0, D: 0 };

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
        btn.addEventListener('click', () => next(opt.cat));
        optionsContainer.appendChild(btn);
        return btn;
    });

    gsap.to(btns, { opacity: 1, x: 0, stagger: 0.1, duration: 0.4, delay: 0.2 });
}

function next(cat) {
    if (scores[cat] !== undefined) scores[cat]++;
    
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
    let winner = 'D';
    let max = -1;
    for (let c in scores) {
        if (scores[c] > max) { max = scores[c]; winner = c; }
    }

    const res = diagnostics[winner];
    document.getElementById('result-profile').textContent = res.profile;
    document.getElementById('result-text').innerHTML = `
        <p><b>O Diagnóstico:</b> ${res.diagnosis}</p>
        <p style="color: var(--penny-green); font-weight: 600; margin-top: 15px;">🚀 <b>A Solução:</b> ${res.solution}</p>
    `;

    transition(screenLoading, screenResult);
    startTimer();
}
