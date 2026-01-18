import { useState, useEffect, useRef } from 'react';
import { Send, CheckCircle2, Loader2, Sparkles, Phone, Mail, Rocket, ExternalLink, ShieldCheck } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export default function TrialChatInterface() {
  const container = useRef();
  const [step, setStep] = useState(0); // 0: Penny Intro, 1: User Form, 2: Success
  const [formData, setFormData] = useState({ phone: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useGSAP(() => {
    // Animate Penny's message bubble
    gsap.from(".penny-bubble", {
      y: 20,
      opacity: 0,
      duration: 0.6,
      ease: "power2.out",
      delay: 0.2
    });

    // Animate Form inside bubble
    gsap.from(".form-container", {
      opacity: 0,
      y: 10,
      duration: 0.5,
      delay: 0.8
    });

  }, { scope: container });

  const formatPhone = (val) => {
    // Simple formatter (can be improved)
    return val.replace(/\D/g, '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const cleanPhone = formatPhone(formData.phone);
    if (cleanPhone.length < 10) {
      setError('Please enter a valid number with Country Code (e.g., 447446196108).');
      return;
    }

    setLoading(true);

    try {
      const baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:8080' 
        : 'https://penny-finance-backend.fly.dev';

      const res = await fetch(`${baseUrl}/api/trial/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone, email: formData.email })
      });

      const data = await res.json();

      if (data.success) {
        setStep(2); // Show Success State
        // Optional: Auto redirect after few seconds
        setTimeout(() => {
            window.location.href = data.redirect;
        }, 3000);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please check your internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={container} className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/30 flex flex-col">
      
      {/* Header Mobile Style */}
      <header className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 py-4 px-6 flex items-center justify-between">
         <div className="flex items-center gap-3">
             <div className="relative">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-emerald-700 p-[2px]">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                        <img 
                          src="/logo.png" 
                          alt="Penny" 
                          className="w-6 h-6 object-contain"
                          style={{ filter: 'invert(1) hue-rotate(180deg)' }} 
                        />
                    </div>
                 </div>
                 <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
             </div>
             <div>
                 <h1 className="font-bold text-sm leading-tight">Penny <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-primary ml-1">AI</span></h1>
                 <p className="text-[10px] text-gray-400">Online now</p>
             </div>
         </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 pt-24 pb-10 px-4 max-w-lg mx-auto w-full flex flex-col justify-end min-h-screen">
         
         {/* Penny Message */}
         <div className="penny-bubble flex items-start gap-4 mb-8">
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-emerald-700 flex-shrink-0 flex items-center justify-center mt-1">
                 <Sparkles className="w-4 h-4 text-white" />
             </div>
             <div className="bg-[#1a1a1a] border border-white/5 p-6 rounded-2xl rounded-tl-none shadow-2xl relative max-w-[90%] w-full">
                 <div className="absolute top-0 left-0 w-0 h-0 border-t-[10px] border-l-[10px] border-t-[#1a1a1a] border-l-transparent -ml-2"></div>
                 
                 <div className="text-gray-200 leading-relaxed text-sm mb-6 space-y-4">
                    <p className="flex items-center gap-2">
                      Hello! <span className="inline-block p-1 bg-white/10 rounded-full"><Sparkles className="w-3 h-3 text-yellow-400"/></span>
                    </p>
                    <p>
                        Please send me your <b>WhatsApp number</b> and <b>Email</b> to activate your <b>2-Day Free Trial</b>.
                    </p>
                    <p>
                        You will have direct access to me without needing to download any apps! Simplicity is my motto. 
                        <span className="inline-block align-middle ml-1"><Rocket className="w-3 h-3 text-primary" /></span>
                    </p>
                 </div>

                 {/* Embedded Interactive Form */}
                 {step === 2 ? (
                     <div className="form-container bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
                         <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                             <CheckCircle2 className="w-6 h-6 text-black" />
                         </div>
                         <h3 className="font-bold text-green-500 mb-1">All set!</h3>
                         <p className="text-xs text-gray-400 mb-4">Redirecting to WhatsApp...</p>
                         <Loader2 className="w-5 h-5 text-green-500 animate-spin mx-auto" />
                     </div>
                 ) : (
                     <form onSubmit={handleSubmit} className="form-container space-y-4">
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                            <input 
                                type="email" 
                                placeholder="Your best email"
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-primary/50 focus:bg-black/60 transition-all placeholder:text-gray-600"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                required
                            />
                        </div>

                        <div className="relative group">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                            <input 
                                type="tel" 
                                placeholder="WhatsApp (with Country Code)"
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-primary/50 focus:bg-black/60 transition-all placeholder:text-gray-600"
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-xs text-center p-2 bg-red-500/10 rounded-lg border border-red-500/20 flex items-center justify-center gap-2">
                                <ShieldCheck className="w-3 h-3" /> {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-primary text-black font-bold py-3.5 rounded-xl hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                <>
                                    <span>Start Free Trial</span>
                                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-gray-600 text-center mt-2 flex items-center justify-center gap-1">
                           <ExternalLink className="w-3 h-3" /> By clicking, you will be redirected to WhatsApp.
                        </p>
                     </form>
                 )}
             </div>
         </div>

      </main>
    </div>
  );
}
