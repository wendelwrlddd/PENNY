import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Phone, Loader2, X } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const PaymentModal = ({ isOpen, onClose }) => {
  const [payPhone, setPayPhone] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [payError, setPayError] = useState('');

  if (!isOpen) return null;

  const handleGeneratePayLink = async (e) => {
    if (e) e.preventDefault();
    setIsGeneratingLink(true);
    setPayError('');

    // Formatar número para padrão internacional (sem o +)
    let formattedPhone = payPhone;
    try {
      const phoneNumber = parsePhoneNumberFromString(payPhone, 'BR') || parsePhoneNumberFromString(payPhone, 'GB');
      if (phoneNumber && phoneNumber.isValid()) {
        formattedPhone = phoneNumber.format('E.164').replace('+', '');
      } else {
        // Fallback for simple cleaning if libphonenumber fails
        formattedPhone = payPhone.replace(/\D/g, '');
      }
    } catch (err) {
      formattedPhone = payPhone.replace(/\D/g, '');
    }

    if (formattedPhone.length < 10) {
      setPayError('Por favor, insira um número de WhatsApp válido.');
      setIsGeneratingLink(false);
      return;
    }

    try {
      const resp = await fetch('/api/pay/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: formattedPhone })
      });

      const data = await resp.json();
      if (resp.ok && data.url) {
        window.location.href = data.url;
      } else {
        setPayError(data.error || 'Erro ao gerar link de pagamento.');
      }
    } catch (err) {
      setPayError('Erro de conexão com o servidor.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 transition-all duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => !isGeneratingLink && onClose()}></div>
      
      <div className="relative w-full max-w-md glass border border-white/10 rounded-[32px] p-8 shadow-[0_0_50px_rgba(34,197,94,0.3)] animate-in zoom-in duration-300">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
          disabled={isGeneratingLink}
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h3 className="text-2xl font-black text-center mb-2 tracking-tight text-white">Ative sua Licença Penny</h3>
        
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 mb-6 flex gap-4">
          <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0" />
          <p className="text-xs text-orange-200/80 leading-relaxed text-left">
            <span className="font-bold text-orange-500 block mb-1 uppercase tracking-wider">Aviso de Segurança:</span>
            Digite o número do WhatsApp que você usará para falar com o Penny. A assinatura será vinculada a ele.
          </p>
        </div>

        <form onSubmit={handleGeneratePayLink} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1 text-left">Seu WhatsApp (com código do país)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="tel"
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                placeholder="Ex: 55 73 99108-2831"
                className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-gray-600 text-white font-medium"
                required
              />
            </div>
          </div>

          {payError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-medium text-center">
              {payError}
            </div>
          )}

          <button
            type="submit"
            disabled={isGeneratingLink || payPhone.length < 8}
            className="w-full py-5 bg-primary text-black font-black rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_20px_40px_rgba(34,197,94,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            {isGeneratingLink ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Gerando link seguro...
              </>
            ) : (
              <>
                Confirmar e Comprar
                <span className="text-xl">👉</span>
              </>
            )}
          </button>
          
          <p className="text-[10px] text-center text-gray-600 font-medium">
            Pagamento Processado com Segurança via PayPal Inc.
          </p>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
