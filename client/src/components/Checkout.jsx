import React, { useState, useEffect } from "react";
import { Lock, ShieldCheck, CreditCard, Phone, Shield, Globe, CheckCircle2, ChevronRight } from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

const PaymentForm = ({ whatsapp, loadingParent, setLoadingParent }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setLocalLoading(true);
    setLoadingParent(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + `/thank-you?phone=${whatsapp}`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message);
      setLocalLoading(false);
      setLoadingParent(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
       try {
           await fetch("/api/verify-payment", {
               method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
           });
           window.location.href = `/thank-you?phone=${whatsapp}`;
       } catch (err) {
           alert("Payment succeeded but verification failed.");
           setLocalLoading(false);
           setLoadingParent(false);
       }
    } else {
        setLocalLoading(false);
        setLoadingParent(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <ShieldCheck size={16} />
            {errorMessage}
        </div>
      )}
      
      <button 
        disabled={!stripe || localLoading || whatsapp.length < 8} 
        className={`w-full bg-[#635BFF] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#544DFF] transition-all flex justify-center items-center shadow-lg shadow-indigo-500/20 gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {localLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
            <>
                <Lock size={18} />
                <span>Pagar R$ 19,90 com Segurança</span>
            </>
        )}
      </button>
      
      <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 font-medium uppercase tracking-widest">
           <span className="flex items-center gap-1"><Shield size={10} /> AES-256 Encryption</span>
           <span className="flex items-center gap-1"><CheckCircle2 size={10} /> Official Partner</span>
      </div>
    </form>
  );
};

const Checkout = () => {
    const [whatsapp, setWhatsapp] = useState("");
    const [paymentMethod, setPaymentMethod] = useState(stripePublicKey ? "card" : "whatsapp"); 
    const [clientSecret, setClientSecret] = useState("");
    const [loading, setLoading] = useState(false);

    // Load Stripe Intent
    useEffect(() => {
        if (paymentMethod === 'card' && stripePublicKey) {
            const createIntent = async () => {
                try {
                    const res = await fetch("/api/create-payment-intent", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ whatsappNumber: whatsapp || "Pending" }), 
                    });
                    if(res.ok){
                        const data = await res.json();
                        setClientSecret(data.clientSecret);
                    }
                } catch (e) {
                    console.error("Stripe load error", e);
                }
            };
            createIntent();
        }
    }, [paymentMethod]); 

    useGSAP(() => {
        gsap.from(".animate-in", { y: 20, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power2.out" });
    });

    return (
        <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
            
            {/* LEFT COLUMN: Checkout Form (60%) */}
            <div className="w-full md:w-[60%] min-h-screen p-6 md:p-12 flex flex-col items-center justify-center bg-white relative overflow-hidden">
                
                {/* Subtle Background Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-purple-500 opacity-20"></div>
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
                
                <div className="max-w-lg w-full z-10 animate-in">
                    {/* Brand Header */}
                    <div className="flex items-center gap-3 mb-12">
                         <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-100 border border-slate-100 overflow-hidden">
                             <img src="/img_checkout/penny_atom.png" alt="Penny" className="w-8 h-8 object-contain" /> 
                         </div>
                         <span className="font-bold text-2xl tracking-tight text-slate-900">Penny</span>
                    </div>

                    <div className="mb-8">
                        <h1 className="text-3xl font-black text-slate-900 mb-2">Secure Checkout</h1>
                        <p className="text-slate-500 text-sm">Join 2,000+ users saving money every day with Penny.</p>
                    </div>

                    {/* Step 1: WhatsApp Identity */}
                    <div className="mb-10 group">
                        <label className="block text-sm font-bold text-slate-700 mb-3 ml-1">Your WhatsApp Number</label>
                        <div className="relative group/input">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-indigo-500 transition-colors">
                                <Phone size={18} />
                            </div>
                            <input 
                                type="tel" 
                                placeholder="(11) 91234-5678" 
                                value={whatsapp}
                                onChange={(e) => setWhatsapp(e.target.value)}
                                className="block w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-lg"
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-3 ml-1 flex items-center gap-1 font-medium">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            Used to instantly activate your Penny Premium account.
                        </p>
                    </div>

                    {/* Payment Info: PayPal Only */}
                    <div className="mb-8">
                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center p-2">
                                <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" alt="PayPal" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Payment via PayPal</h4>
                                <p className="text-slate-500 text-xs">Secure instant subscription in GBP.</p>
                            </div>
                        </div>
                    </div>

                    {/* DYNAMIC CONTENT AREA */}
                    <div className="min-h-[200px]">
                        <PayPalScriptProvider options={{ "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID, currency: "GBP" }}>
                            <div className="animate-fadeIn space-y-6">
                                {whatsapp.length > 8 ? (
                                    <div className="space-y-4">
                                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 items-start">
                                            <Shield className="text-amber-600 shrink-0 mt-0.5" size={18} />
                                            <div className="text-xs text-amber-800 leading-relaxed font-medium">
                                                You are about to activate your subscription via PayPal. Please ensure your PayPal email is accessible.
                                            </div>
                                        </div>
                                        <PayPalButtons 
                                            style={{ layout: "vertical", shape: "rect", borderRadius: 12, height: 54, color: 'blue' }}
                                            createOrder={(data, actions) => {
                                                return fetch("/api/create-order", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ whatsappNumber: whatsapp }) 
                                                })
                                                .then((res) => res.json())
                                                .then((order) => order.id);
                                            }}
                                            onApprove={(data, actions) => {
                                                return fetch("/api/capture-order", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ orderID: data.orderID })
                                                })
                                                .then((res) => res.json())
                                                .then((details) => {
                                                    if (details.status === 'success' || details.status === 'COMPLETED') {
                                                        window.location.href = "/thank-you?phone=" + whatsapp;
                                                    } else {
                                                        alert("Payment processed. Status: " + (details.message || details.status));
                                                    }
                                                });
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="p-8 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 text-center space-y-2">
                                        <div className="inline-block p-3 bg-white rounded-full shadow-sm text-slate-300">
                                            <Phone size={24} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-500">Enter your WhatsApp number above</p>
                                        <p className="text-xs">Once provided, the PayPal buttons will be securely unlocked.</p>
                                    </div>
                                )}
                            </div>
                        </PayPalScriptProvider>
                    </div>
                    
                    {/* GDPR Compliant Badge */}
                    <div className="mt-12 flex items-center justify-center gap-6 opacity-40 grayscale hover:grayscale-0 hover:opacity-80 transition-all">
                        <img src="/img_checkout/stripe_logo.png" alt="Stripe" className="h-5" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-5" />
                        <div className="h-4 w-px bg-slate-300"></div>
                        <span className="text-[10px] font-black tracking-widest uppercase">GDPR Compliant</span>
                    </div>

                </div>
            </div>

            {/* RIGHT COLUMN: Order Summary (40%) */}
            <div className="w-full md:w-[40%] bg-slate-50 border-l border-slate-100 p-6 md:p-12 min-h-screen relative flex flex-col pt-24 md:pt-32">
                 
                 <div className="sticky top-12 max-w-sm mx-auto w-full animate-in" style={{ animationDelay: '200ms' }}>
                     
                     <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                         <div className="p-8">
                             <div className="flex items-center justify-between mb-8">
                                 <h3 className="font-black text-xl text-slate-900">Order Summary</h3>
                                 <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Annual Offer</span>
                             </div>

                             <div className="space-y-6">
                                 <div className="flex items-start gap-4">
                                     <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 overflow-hidden p-2">
                                         <img src="/img_checkout/penny_atom.png" alt="Penny" className="w-full h-full object-contain" />
                                     </div>
                                     <div className="flex-1">
                                         <h4 className="font-bold text-slate-900 leading-tight">Penny Premium Plan</h4>
                                         <p className="text-xs text-slate-500 mt-0.5">Full AI Financial Assistant access</p>
                                     </div>
                                     <span className="font-bold text-slate-900">£99.90</span>
                                 </div>

                                 <div className="h-px bg-slate-100"></div>

                                 <div className="space-y-3">
                                     <div className="flex justify-between text-sm font-medium text-slate-500">
                                         <span>Subscription (Annual)</span>
                                         <span>£99.90</span>
                                     </div>
                                     <div className="flex justify-between text-sm font-medium text-emerald-600 italic">
                                         <span className="flex items-center gap-1">
                                             <CheckCircle2 size={14} /> Founder's Launch Discount
                                         </span>
                                         <span>-£89.91</span>
                                     </div> 
                                     <div className="flex justify-between text-sm font-medium text-slate-500">
                                         <span>VAT (Included)</span>
                                         <span>£0.00</span>
                                     </div>
                                 </div>
                             </div>
                         </div>
                         
                         <div className="bg-slate-900 p-8 text-white relative">
                             <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                             <div className="flex justify-between items-end">
                                 <div>
                                     <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-1">Final Amount</p>
                                     <span className="text-4xl font-black italic">£9.99</span>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-slate-400 text-[10px] line-through">Original £99.90</p>
                                     <p className="text-white text-[10px] bg-indigo-600 px-2 py-0.5 rounded-full inline-block font-bold mt-1">Saves £89.91</p>
                                 </div>
                             </div>
                         </div>
                     </div>

                     {/* Why Penny? Mini Section */}
                     <div className="mt-8 space-y-4 px-4">
                         <div className="flex gap-4 items-center">
                             <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-emerald-500">
                                 <CheckCircle2 size={20} />
                             </div>
                             <div>
                                 <h5 className="text-sm font-bold text-slate-900 leading-none">Immediate Access</h5>
                                 <p className="text-[11px] text-slate-500 mt-1">Unlock your dashboard within 60 seconds of payment.</p>
                             </div>
                         </div>
                         
                         <div className="flex gap-4 items-center">
                             <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-indigo-500">
                                 <Globe size={20} />
                             </div>
                             <div>
                                 <h5 className="text-sm font-bold text-slate-900 leading-none">Cancel via Chat</h5>
                                 <p className="text-[11px] text-slate-500 mt-1">No complicated portals. Just text Penny to manage plan.</p>
                             </div>
                         </div>
                     </div>

                     {/* Money Back Guarantee Badge */}
                     <div className="mt-12 group p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 flex items-center gap-4 transition-all hover:bg-indigo-50">
                         <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 border border-indigo-100">
                             <ShieldCheck size={28} />
                         </div>
                         <div>
                             <h4 className="font-bold text-sm text-slate-900 leading-tight">Pure Satisfaction Guarantee</h4>
                             <p className="text-[10px] text-slate-500 mt-1">7-day hassle-free money back. No questions asked.</p>
                         </div>
                         <ChevronRight size={14} className="ml-auto text-indigo-300 group-hover:translate-x-1 transition-transform" />
                     </div>

                 </div>
            </div>
        </div>
    );
};

export default Checkout;
