import React, { useEffect, useState } from 'react';
import { CheckCircle, MessageCircle, ArrowRight, ShieldCheck } from 'lucide-react';

const ThankYou = () => {
    const [whatsapp, setWhatsapp] = useState('');

    useEffect(() => {
        // Tenta pegar o número da URL (?phone=...)
        const params = new URLSearchParams(window.location.search);
        const phone = params.get('phone');
        if (phone) setWhatsapp(phone);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl p-8 text-center border border-gray-100">
                
                {/* Ícone de Sucesso Animado */}
                <div className="mb-6 flex justify-center">
                    <div className="bg-green-100 p-4 rounded-full animate-bounce-slow">
                        <CheckCircle className="w-16 h-16 text-green-600" strokeWidth={2} />
                    </div>
                </div>

                <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
                    Subscription Confirmed!
                </h1>
                <p className="text-gray-500 mb-8 text-lg">
                    Welcome to the Penny Premium family.
                </p>

                {/* Next Steps Card */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8 text-left">
                    <h3 className="text-blue-900 font-bold flex items-center mb-3">
                        <MessageCircle className="w-5 h-5 mr-2" />
                        What happens now?
                    </h3>
                    <p className="text-blue-800 leading-relaxed">
                        Your account has been successfully activated!
                        {whatsapp && (
                            <span className="block mt-2 font-medium">
                                Active Number: <span className="underline">{whatsapp}</span>
                            </span>
                        )}
                    </p>
                    <div className="mt-4 pt-4 border-t border-blue-200">
                        <p className="text-sm text-blue-700">
                            Message Penny and start tracking your expenses!
                        </p>
                    </div>
                </div>

                {/* CTA Button */}
                <a 
                    href={whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : "https://wa.me/"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg mb-6 group"
                >
                    <MessageCircle className="w-6 h-6 mr-2 group-hover:animate-pulse" />
                    Open WhatsApp
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </a>

                {/* Footer Guarantee */}
                <div className="flex items-center justify-center text-gray-400 text-sm">
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                    Secure payment via PayPal. 7-day money back guarantee.
                </div>
            </div>

            <div className="mt-8 text-gray-400 text-sm">
                Penny Finance © {new Date().getFullYear()}
            </div>
        </div>
    );
};

export default ThankYou;
