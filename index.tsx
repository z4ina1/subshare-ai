import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import {
  Users,
  Upload,
  CheckCircle,
  Plus,
  Zap,
  MessageCircle,
  Camera,
  User,
  X,
  ScanLine,
  History,
  Sparkles,
  Copy,
  Clock,
  Banknote,
  Info,
  Activity,
  Trash2,
  ShieldCheck,
  TrendingUp,
  Eye,
  Bell,
  AlertTriangle,
  ChevronRight,
  Shield,
  FileText,
  Hash,
  Wallet,
  Tag,
  CreditCard
} from "lucide-react";

// --- Types ---
type MemberStatus = "empty" | "pending" | "paid";

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'verified';
  method: string;
  transactionId?: string;
  sender?: string;
}

interface Member {
  id: string;
  name: string;
  status: MemberStatus;
  paymentHistory: PaymentRecord[];
  expenses: Expense[];
}

interface Service {
  id: string;
  name: string;
  price: number;
  currency: string;
  maxSlots: number;
  renewalDate: string;
  credentials: string; 
  paymentInstructions?: string;
  members: Member[];
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// --- Components ---

const Sparkline = ({ data }: { data: number[] }) => {
  const width = 100;
  const height = 30;
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width="100%" height="32" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <polyline
        fill="none"
        stroke="#6366f1" // indigo-500
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

// --- Utils ---
const encrypt = (text: string) => `enc_${btoa(text)}`;
const decrypt = (text: string) => {
  try { return atob(text.replace("enc_", "")); } catch { return text; }
};

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const calculateDaysLeft = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const cleanAIJson = (jsonStr: string) => {
  try {
    const cleaned = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.error("AI Parsing Error:", e);
    return null;
  }
};

const App = () => {
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<string>("");
  const [revealCreds, setRevealCreds] = useState<{id: string, timeLeft: number} | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [verifyState, setVerifyState] = useState<'idle' | 'scanning' | 'review' | 'success' | 'error'>('idle');
  const [verifyImage, setVerifyImage] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{valid: boolean, amount: number, sender: string, reason: string, transactionId?: string} | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState<{ serviceId: string, memberId: string } | null>(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState<{ serviceId: string, memberId: string } | null>(null);
  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState<{ serviceId: string } | null>(null);
  const [viewMember, setViewMember] = useState<{service: Service, member: Member} | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const stats = useMemo(() => {
    const totalCost = services.reduce((acc, s) => acc + s.price, 0);
    const totalCollected = services.reduce((acc, s) => {
      const perSlot = s.price / s.maxSlots;
      return acc + s.members.filter(m => m.status === 'paid').length * perSlot;
    }, 0);
    const totalMembers = services.reduce((acc, s) => acc + s.members.filter(m => m.status !== 'empty').length, 0);
    const totalSlots = services.reduce((acc, s) => acc + s.maxSlots, 0);
    const collectionRate = totalCost > 0 ? (totalCollected / totalCost) * 100 : 0;
    const trend = [30, 45, 40, 60, collectionRate > 5 ? collectionRate - 5 : 0, collectionRate];
    return { totalCost, totalCollected, totalMembers, totalSlots, collectionRate, trend };
  }, [services]);

  const timerRef = useRef<any>(null);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast("Copied to clipboard", "info");
  };

  useEffect(() => {
    const saved = localStorage.getItem("subshare_v13_services");
    if (saved) {
      setServices(JSON.parse(saved));
    } else {
      setServices([
        {
          id: "1",
          name: "Netflix Premium",
          price: 186000,
          currency: "IDR",
          maxSlots: 5,
          renewalDate: new Date(Date.now() + 864000000).toISOString().split('T')[0],
          credentials: encrypt("user@netflix.com | Pass: H3lloWorld"),
          paymentInstructions: "Transfer ke BCA 8821992121 a/n Admin SubShare",
          members: [
            { id: "m1", name: "Admin", status: "paid", paymentHistory: [{ id: 'init-1', date: new Date().toISOString(), amount: 186000/5, status: 'paid', method: 'System', sender: 'Admin', transactionId: 'TX-ADMIN-INIT' }], expenses: [] },
            { id: "m2", name: "Budi Santoso", status: "pending", paymentHistory: [], expenses: [] },
            { id: "m3", name: "", status: "empty", paymentHistory: [], expenses: [] },
            { id: "m4", name: "", status: "empty", paymentHistory: [], expenses: [] },
            { id: "m5", name: "", status: "empty", paymentHistory: [], expenses: [] },
          ]
        }
      ]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("subshare_v13_services", JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    if (revealCreds && revealCreds.timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setRevealCreds(prev => prev ? { ...prev, timeLeft: prev.timeLeft - 1 } : null);
      }, 1000);
    } else if (revealCreds?.timeLeft === 0) {
      setRevealCreds(null);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [revealCreds]);

  const generateAIReminder = async (service: Service) => {
    setLoadingAI(true);
    setAiMessage("AI sedang merangkai pesan...");
    const unpaid = service.members.filter(m => m.status === 'pending');
    if (unpaid.length === 0) {
      addToast("Semua member sudah lunas", "info");
      setLoadingAI(false);
      return;
    }
    const names = unpaid.map(m => m.name).join(", ");
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Buatkan pesan WhatsApp singkat, sopan, untuk menagih iuran ${service.name} kepada ${names}. Total: Rp ${Math.ceil(service.price/service.maxSlots).toLocaleString()}. Instruksi: ${service.paymentInstructions}.`
      });
      copyToClipboard(response.text || "");
      addToast("Pesan AI berhasil disalin", "success");
    } catch (e) {
      addToast("Terjadi kesalahan AI", "error");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleScanInvoice = async (file: File) => {
    setLoadingAI(true);
    setAiMessage("AI sedang memindai struk...");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        const ai = getAI();
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { inlineData: { mimeType: file.type, data: base64Data } },
              { text: "Extract serviceName, totalPrice, renewalDate (YYYY-MM-DD), and maxSlots. Return JSON." }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                serviceName: { type: Type.STRING },
                totalPrice: { type: Type.NUMBER },
                renewalDate: { type: Type.STRING },
                maxSlots: { type: Type.INTEGER }
              },
              required: ["serviceName", "totalPrice", "renewalDate", "maxSlots"]
            }
          }
        });
        
        const data = cleanAIJson(response.text || "{}");
        if (data && data.serviceName) {
           const newService: Service = {
             id: Date.now().toString(),
             name: data.serviceName,
             price: data.totalPrice || 0,
             currency: "IDR",
             maxSlots: data.maxSlots || 4,
             renewalDate: data.renewalDate || new Date().toISOString().split('T')[0],
             credentials: encrypt("Belum diatur"),
             members: Array.from({ length: data.maxSlots || 4 }).map((_, i) => ({
               id: `m-${Date.now()}-${i}`,
               name: i === 0 ? "Admin" : "",
               status: i === 0 ? "paid" : "empty",
               paymentHistory: i === 0 ? [{ id: `p-${Date.now()}`, date: new Date().toISOString(), amount: (data.totalPrice || 0) / (data.maxSlots || 4), status: 'paid', method: 'Owner', sender: 'Admin', transactionId: `TX-OWNER-${Date.now()}` }] : [],
               expenses: []
             }))
           };
           setServices(prev => [...prev, newService]);
           setIsAddModalOpen(false);
           addToast("Layanan berhasil ditambahkan", "success");
        }
      };
    } catch (e) {
      addToast("Gagal memindai struk", "error");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleVerifyPayment = async (file: File, serviceId: string, memberId: string, expectedAmount: number) => {
    const service = services.find(s => s.id === serviceId);
    const member = service?.members.find(m => m.id === memberId);
    if (!member) return;

    setVerifyState('scanning');
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
        const base64Content = (reader.result as string).split(",")[1];
        setVerifyImage(reader.result as string); 
        try {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: {
                    parts: [
                        { inlineData: { mimeType: file.type, data: base64Content } },
                        { text: `Analyze this bank transfer receipt.
                        Expected Amount: Rp ${expectedAmount}
                        Expected Sender Name (approximately): ${member.name}
                        
                        Verify if:
                        1. The amount matches (or is very close).
                        2. The sender name on the receipt matches the expected sender.
                        
                        Also try to find a transaction ID or Ref Number.
                        Return JSON.` }
                    ]
                },
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      valid: { type: Type.BOOLEAN, description: "True if amount matches and sender is identifiable" },
                      detectedAmount: { type: Type.NUMBER, description: "The amount found on the receipt" },
                      detectedSender: { type: Type.STRING, description: "The name of the sender found on the receipt" },
                      transactionId: { type: Type.STRING, description: "Reference number found on receipt" },
                      reason: { type: Type.STRING, description: "Explanation of the validation result" }
                    },
                    required: ["valid", "detectedAmount", "detectedSender", "reason"]
                  }
                }
            });
            const result = cleanAIJson(response.text || "{}");
            if (result && result.valid) {
                 setVerifyResult({ 
                   valid: true, 
                   amount: result.detectedAmount, 
                   sender: result.detectedSender, 
                   reason: result.reason,
                   transactionId: result.transactionId || `TX-${Math.random().toString(36).toUpperCase().substring(2,10)}`
                 });
                 setVerifyState('review');
            } else {
                 setVerifyState('error');
                 setAiMessage(result?.reason || "AI could not verify this receipt. Please check manually.");
            }
        } catch (e) {
            setVerifyState('error');
            setAiMessage("AI processing failed. Check your network or API key.");
        }
    };
  };

  const updateMemberStatus = (sId: string, mId: string, status: MemberStatus, paidAmount?: number, senderName?: string, txId?: string) => {
    setServices(prev => prev.map(s => {
      if (s.id !== sId) return s;
      return {
        ...s,
        members: s.members.map(m => {
          if (m.id !== mId) return m;
          let newHistory = [...m.paymentHistory];
          if (status === 'paid' && paidAmount) {
             newHistory = [{
               id: `p-${Date.now()}`,
               date: new Date().toISOString().split('T')[0],
               amount: paidAmount,
               status: 'paid',
               method: txId ? "AI Verified" : "Manual",
               sender: senderName || m.name,
               transactionId: txId || `TX-M-${Date.now()}`
             }, ...m.paymentHistory];
             addToast("Payment Confirmed!", "success");
          }
          return { ...m, status, paymentHistory: newHistory };
        })
      };
    }));
  };

  const addMemberExpense = (sId: string, mId: string, expense: Omit<Expense, 'id'>) => {
    const newExpense = { ...expense, id: `exp-${Date.now()}` };
    setServices(prev => prev.map(s => {
      if (s.id !== sId) return s;
      return {
        ...s,
        members: s.members.map(m => {
          if (m.id !== mId) return m;
          return { ...m, expenses: [newExpense, ...m.expenses] };
        })
      };
    }));
    // Update viewMember state if open
    if (viewMember && viewMember.member.id === mId) {
      setViewMember(prev => prev ? {
        ...prev,
        member: { ...prev.member, expenses: [newExpense, ...prev.member.expenses] }
      } : null);
    }
    addToast("Expense added", "success");
    setIsAddingExpense(false);
  };

  const deleteMemberExpense = (sId: string, mId: string, eId: string) => {
    setServices(prev => prev.map(s => {
      if (s.id !== sId) return s;
      return {
        ...s,
        members: s.members.map(m => {
          if (m.id !== mId) return m;
          return { ...m, expenses: m.expenses.filter(e => e.id !== eId) };
        })
      };
    }));
    if (viewMember && viewMember.member.id === mId) {
      setViewMember(prev => prev ? {
        ...prev,
        member: { ...prev.member, expenses: prev.member.expenses.filter(e => e.id !== eId) }
      } : null);
    }
    addToast("Expense deleted", "info");
  };

  const deleteService = (id: string) => {
    if (window.confirm("Hapus layanan ini?")) {
      setServices(prev => prev.filter(s => s.id !== id));
      addToast("Layanan dihapus", "info");
    }
  };

  const claimSlot = (sId: string, mId: string, name: string) => {
    if (!name.trim()) return;
    setServices(prev => prev.map(s => s.id === sId ? { ...s, members: s.members.map(m => m.id === mId ? { ...m, name, status: "pending" } : m) } : s));
    setIsClaimModalOpen(null);
    addToast(`Halo ${name}, kamu telah bergabung!`, "success");
  };

  return (
    <div className="min-h-screen text-zinc-900 pb-32">
      <div className="ambient-mesh"></div>
      
      {/* Soft Toast System */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 pointer-events-none w-full max-w-xs px-4">
        {toasts.map(toast => (
          <div key={toast.id} className="px-5 py-3 rounded-2xl bg-white border border-zinc-200 shadow-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 pointer-events-auto">
            {toast.type === 'success' ? <CheckCircle size={18} className="text-emerald-500" /> : toast.type === 'error' ? <AlertTriangle size={18} className="text-rose-500" /> : <Info size={18} className="text-indigo-500" />}
            <p className="text-[11px] font-bold text-zinc-800 tracking-tight">{toast.message}</p>
          </div>
        ))}
      </div>

      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/70 backdrop-blur-3xl">
        <div className="max-w-2xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
               <Zap className="text-white w-4 h-4 fill-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tighter uppercase leading-none">SubShare</h1>
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.25em] mt-1">Light Edition</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAdmin(!isAdmin)}
            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${isAdmin ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'}`}
          >
            {isAdmin ? "Admin Console" : "Member Mode"}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-10 space-y-8 animate-fade-in">
        {/* Soft Dashboard */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 sm:col-span-8 soft-card p-10 rounded-[3rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 blur-[60px] rounded-full -mr-16 -mt-16 opacity-50"></div>
            <div className="relative z-10">
              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Collection Progress</p>
              <div className="flex items-baseline gap-5">
                 <p className="text-6xl font-black tracking-tighter text-zinc-900">{Math.round(stats.collectionRate)}%</p>
                 <div className="w-20"><Sparkline data={stats.trend} /></div>
              </div>
              <div className="mt-10 h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-1000 ease-out" style={{ width: `${stats.collectionRate}%` }}></div>
              </div>
            </div>
          </div>
          
          <div className="col-span-6 sm:col-span-4 soft-card p-8 rounded-[2.5rem] flex flex-col justify-between hover:bg-zinc-50 transition-colors">
             <div className="text-indigo-600"><Activity size={22} /></div>
             <div>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Efficiency</p>
               <p className="text-2xl font-black text-zinc-900 tracking-tight mt-1">High</p>
             </div>
          </div>
          
          <div className="col-span-6 sm:col-span-4 soft-card p-8 rounded-[2.5rem] flex flex-col justify-between hover:bg-zinc-50 transition-colors">
             <div className="text-emerald-600"><Users size={22} /></div>
             <div>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Seats</p>
               <p className="text-2xl font-black text-zinc-900 tracking-tight mt-1">{stats.totalMembers}<span className="text-zinc-300 text-lg font-bold ml-1">/{stats.totalSlots}</span></p>
             </div>
          </div>
        </div>

        {/* Subscription Feed */}
        <div className="space-y-6">
          <div className="flex items-center gap-4 px-2">
             <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Your Subscriptions</h3>
             <div className="h-[1px] flex-1 bg-zinc-200"></div>
          </div>

          {services.map(service => {
            const perSlot = Math.ceil(service.price / service.maxSlots);
            const daysLeft = calculateDaysLeft(service.renewalDate);
            const isRevealed = revealCreds?.id === service.id;
            
            return (
              <div key={service.id} className="soft-card rounded-[3.5rem] overflow-hidden group hover:shadow-2xl hover:shadow-zinc-200/50 transition-all duration-500">
                <div className="p-10">
                  <div className="flex justify-between items-start mb-12">
                    <div className="space-y-4">
                      <h2 className="text-4xl font-extrabold text-zinc-900 tracking-tighter leading-none">{service.name}</h2>
                      <div className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full bg-zinc-50 border border-zinc-100`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${daysLeft < 5 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                        {daysLeft < 0 ? "Expired" : `${daysLeft} Days Remaining`}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Fee/Slot</p>
                      <p className="text-4xl font-black text-zinc-900 tracking-tighter leading-none">
                        {(perSlot/1000).toFixed(0)}<span className="text-zinc-300 text-2xl font-bold ml-0.5">k</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mb-12">
                    {service.members.map((m) => (
                      <div 
                        key={m.id} 
                        onClick={() => {
                          if (m.status === 'empty') setIsClaimModalOpen({ serviceId: service.id, memberId: m.id });
                          else if (!isAdmin && m.status === 'pending') setIsPayModalOpen({ serviceId: service.id, memberId: m.id });
                          else setViewMember({ service, member: m });
                        }}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-90 ${m.status === 'paid' ? 'bg-zinc-900 text-white shadow-xl shadow-zinc-200' : m.status === 'pending' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'border-2 border-dashed border-zinc-200 text-zinc-300 hover:border-zinc-400 hover:text-zinc-400'}`}
                      >
                         {m.status === 'paid' ? <CheckCircle size={22} strokeWidth={2.5} /> : m.status === 'pending' ? <User size={22} /> : <Plus size={22} />}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 relative overflow-hidden group/box">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Authentication</p>
                      <div className="flex items-center justify-between">
                         <code className={`text-[11px] font-bold transition-all truncate ${isRevealed ? 'text-zinc-900' : 'text-zinc-300'}`}>
                           {isRevealed ? decrypt(service.credentials) : "••••••••••••"}
                         </code>
                         <button onClick={() => isRevealed ? copyToClipboard(decrypt(service.credentials)) : setRevealCreds({id: service.id, timeLeft: 10})} className="p-2 hover:bg-zinc-200 rounded-lg text-zinc-400 transition-colors"><Eye size={16} /></button>
                      </div>
                    </div>
                    
                    <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 relative overflow-hidden">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Payment Info</p>
                      <div className="flex items-center justify-between">
                         <p className="text-[11px] text-zinc-600 font-bold truncate pr-4">{service.paymentInstructions || "Direct Contact"}</p>
                         <button onClick={() => isAdmin ? setIsInstructionModalOpen({ serviceId: service.id }) : copyToClipboard(service.paymentInstructions || "")} className="p-2 hover:bg-zinc-200 rounded-lg text-zinc-400 transition-colors"><Info size={16} /></button>
                      </div>
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="px-10 py-6 bg-zinc-50/50 border-t border-zinc-100 flex gap-4">
                    <button onClick={() => deleteService(service.id)} className="p-4 hover:bg-rose-50 text-zinc-300 hover:text-rose-500 transition-all rounded-2xl"><Trash2 size={20} /></button>
                    <button onClick={() => generateAIReminder(service)} className="flex-1 bg-white border border-zinc-200 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all active:scale-95 shadow-sm">
                      <MessageCircle size={18} /> 
                      Remind Group
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {isAdmin && (
        <button 
          onClick={() => setIsAddModalOpen(true)} 
          className="fixed bottom-10 right-10 w-20 h-20 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-200 flex items-center justify-center hover:scale-105 active:scale-90 transition-all duration-500 z-50 group"
        >
          <Plus size={36} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
        </button>
      )}

      {/* MODAL ENGINE */}
      {(isAddModalOpen || isPayModalOpen || viewMember || isClaimModalOpen || isInstructionModalOpen) && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-md" onClick={() => { 
            setIsAddModalOpen(false); setIsPayModalOpen(null); setViewMember(null); setIsClaimModalOpen(null); setIsInstructionModalOpen(null);
            setIsAddingExpense(false);
          }} />
          <div className="relative w-full max-w-lg bg-white border border-zinc-200 p-12 rounded-t-[4rem] sm:rounded-[4rem] shadow-2xl animate-in slide-in-from-bottom-12 duration-700 max-h-[92vh] overflow-y-auto scrollbar-hide">
            <div className="w-12 h-1.5 bg-zinc-100 rounded-full mx-auto mb-10 sm:hidden" />
            
            {isAddModalOpen && (
              <div className="space-y-10">
                 <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tighter uppercase text-zinc-900">New Group</h2>
                    <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Minimalist Setup</p>
                 </div>
                 <div className="p-10 border-2 border-dashed border-zinc-100 rounded-[3rem] bg-zinc-50 flex flex-col items-center justify-center gap-4 group cursor-pointer hover:bg-white hover:border-indigo-200 transition-all relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleScanInvoice(e.target.files[0])} />
                    <Camera size={40} className="text-zinc-300 group-hover:text-indigo-600 transition-colors" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Scan Bill with AI</p>
                 </div>
                 <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const slots = Number(fd.get('slots'));
                    const price = Number(fd.get('price'));
                    const ns: Service = {
                      id: Date.now().toString(),
                      name: fd.get('name') as string,
                      price: price,
                      currency: "IDR",
                      maxSlots: slots,
                      renewalDate: fd.get('date') as string,
                      credentials: encrypt(fd.get('creds') as string),
                      members: Array.from({ length: slots }).map((_, i) => ({ 
                        id: `m-${Date.now()}-${i}`, 
                        name: i === 0 ? "Admin" : "", 
                        status: i === 0 ? "paid" : "empty", 
                        paymentHistory: i === 0 ? [{ id: `p-${Date.now()}`, date: new Date().toISOString(), amount: price/slots, status: 'paid', method: 'Owner', sender: 'Admin', transactionId: `TX-OWNER-${Date.now()}` }] : [],
                        expenses: []
                      }))
                    };
                    setServices(prev => [...prev, ns]);
                    setIsAddModalOpen(false);
                 }} className="space-y-5">
                    <input required name="name" placeholder="Service Name" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-5 text-zinc-900 font-bold outline-none focus:bg-white focus:border-indigo-400 transition-all" />
                    <div className="grid grid-cols-2 gap-4">
                      <input required name="price" type="number" placeholder="Total Cost" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-5 text-zinc-900 font-bold outline-none focus:bg-white focus:border-indigo-400" />
                      <input required name="slots" type="number" placeholder="Slots" defaultValue={5} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-5 text-zinc-900 font-bold outline-none focus:bg-white focus:border-indigo-400" />
                    </div>
                    <input required name="creds" placeholder="Credentials (e.g. Email | Pass)" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-5 text-zinc-900 font-bold outline-none focus:bg-white focus:border-indigo-400" />
                    <button type="submit" className="w-full bg-zinc-900 text-white font-black py-6 rounded-3xl text-[12px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-zinc-200">Launch Group</button>
                 </form>
              </div>
            )}

            {isPayModalOpen && (
              <div className="space-y-12 text-center">
                 <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 mb-6 border border-indigo-100 shadow-sm"><Upload size={44} /></div>
                 <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900">Verify Payment</h2>
                 <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest -mt-8">AI-Powered Verification Engine</p>
                 <label className="block aspect-video bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-[3rem] relative overflow-hidden cursor-pointer group hover:bg-white hover:border-indigo-400 transition-all">
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
                       <Camera size={48} className="group-hover:text-indigo-600 transition-colors" />
                       <p className="text-[10px] font-black mt-5 uppercase tracking-widest">Upload Receipt</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                       if (e.target.files?.[0]) {
                         const s = services.find(s => s.id === isPayModalOpen.serviceId);
                         if (s) handleVerifyPayment(e.target.files[0], isPayModalOpen.serviceId, isPayModalOpen.memberId, s.price/s.maxSlots);
                       }
                    }} />
                 </label>
              </div>
            )}

            {isClaimModalOpen && (
               <div className="space-y-12 text-center">
                 <div className="mx-auto w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm"><Plus size={44} /></div>
                 <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900">Join Subscription</h2>
                 <input id="claim-name" placeholder="Input Your Name" className="w-full bg-zinc-50 border border-zinc-200 rounded-[2.5rem] px-10 py-8 text-2xl font-black text-center text-zinc-900 outline-none focus:bg-white focus:border-emerald-400 transition-all" />
                 <button onClick={() => claimSlot(isClaimModalOpen.serviceId, isClaimModalOpen.memberId, (document.getElementById('claim-name') as HTMLInputElement).value)} className="w-full bg-zinc-900 text-white font-black py-7 rounded-3xl text-[12px] uppercase tracking-widest shadow-xl shadow-zinc-200">Confirm Enrollment</button>
               </div>
            )}

            {viewMember && (
              <div className="space-y-12 pb-10">
                 <div className="flex items-center gap-10">
                    <div className="w-24 h-24 rounded-[2rem] bg-zinc-900 flex items-center justify-center text-white font-black text-4xl shadow-xl shadow-zinc-300">
                      {viewMember.member.name.charAt(0) || "?"}
                    </div>
                    <div>
                      <h2 className="text-4xl font-black uppercase tracking-tighter text-zinc-900 leading-none">{viewMember.member.name || "Open Slot"}</h2>
                      <div className="flex items-center gap-3 mt-4">
                        <div className={`w-2 h-2 rounded-full ${viewMember.member.status === 'paid' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-200'}`}></div>
                        <p className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">{viewMember.member.status}</p>
                      </div>
                    </div>
                 </div>

                 {/* Segment Control / Tabs Visual */}
                 <div className="space-y-12">
                   {/* Expenses Tracking Section */}
                   <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Individual Expenses</h3>
                         <button 
                           onClick={() => setIsAddingExpense(!isAddingExpense)}
                           className="flex items-center gap-2 text-indigo-600 font-black text-[9px] uppercase tracking-widest hover:bg-indigo-50 px-3 py-1.5 rounded-full transition-all"
                         >
                           {isAddingExpense ? <X size={12}/> : <Plus size={12} />}
                           {isAddingExpense ? "Cancel" : "Add Spending"}
                         </button>
                      </div>

                      {isAddingExpense && (
                        <div className="bg-zinc-50 border border-zinc-200 p-8 rounded-[2.5rem] space-y-4 animate-in slide-in-from-top-4 duration-500">
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            addMemberExpense(viewMember.service.id, viewMember.member.id, {
                              date: new Date().toISOString(),
                              amount: Number(fd.get('amount')),
                              category: fd.get('category') as string,
                              description: fd.get('description') as string
                            });
                          }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <input required name="amount" type="number" placeholder="Amount" className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-zinc-900 font-bold outline-none" />
                              <select required name="category" className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-zinc-900 font-bold outline-none appearance-none">
                                <option value="Upgrade">Upgrade</option>
                                <option value="Add-on">Add-on</option>
                                <option value="Late Fee">Late Fee</option>
                                <option value="Gift">Gift</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                            <input required name="description" placeholder="Description (e.g. 4K Upgrade)" className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-zinc-900 font-bold outline-none" />
                            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95">Save Expense</button>
                          </form>
                        </div>
                      )}

                      <div className="space-y-3">
                        {viewMember.member.expenses?.length === 0 && !isAddingExpense ? (
                          <div className="p-10 text-center bg-zinc-50/50 rounded-[2.5rem] border border-dashed border-zinc-200">
                            <p className="text-zinc-300 font-bold text-[11px] uppercase tracking-widest">No extra spending logged</p>
                          </div>
                        ) : (
                          viewMember.member.expenses?.map(exp => (
                            <div key={exp.id} className="flex items-center gap-5 p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 group">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                                <Tag size={18} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-zinc-900 uppercase truncate">{exp.description}</p>
                                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{exp.category} • {new Date(exp.date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-zinc-900">Rp {exp.amount.toLocaleString()}</p>
                                <button onClick={() => deleteMemberExpense(viewMember.service.id, viewMember.member.id, exp.id)} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Trash2 size={12}/></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                   </div>

                   {/* Payment History Section */}
                   <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Payment History</h3>
                         <History size={14} className="text-zinc-300" />
                      </div>
                      <div className="space-y-4">
                        {viewMember.member.paymentHistory.length === 0 ? (
                          <div className="p-12 text-center bg-zinc-50 rounded-[2.5rem] border border-zinc-100">
                            <p className="text-zinc-300 font-bold text-sm italic">No records found.</p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {viewMember.member.paymentHistory.map(rec => (
                              <div key={rec.id} className="relative p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 hover:border-indigo-100 hover:bg-white transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                                      {new Date(rec.date).toLocaleDateString('id-ID', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-black uppercase tracking-tighter text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                        {rec.status}
                                      </span>
                                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{rec.method}</span>
                                    </div>
                                  </div>
                                  <p className="text-zinc-900 font-black text-xl">Rp {rec.amount.toLocaleString()}</p>
                                </div>
                                
                                <div className="flex flex-col gap-2 pt-4 border-t border-zinc-100">
                                  {rec.transactionId && (
                                    <div className="flex items-center gap-2 text-zinc-300 group-hover:text-zinc-500 transition-colors">
                                      <Hash size={12} />
                                      <code className="text-[10px] font-bold tracking-tight">{rec.transactionId}</code>
                                      <button onClick={() => copyToClipboard(rec.transactionId || "")} className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded transition-all"><Copy size={10} /></button>
                                    </div>
                                  )}
                                  {rec.sender && (
                                    <div className="flex items-center gap-2 text-zinc-300 group-hover:text-zinc-400 transition-colors">
                                      <User size={12} />
                                      <span className="text-[10px] font-bold uppercase tracking-widest">Verified Sender: {rec.sender}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                   </div>
                 </div>

                 {isAdmin && viewMember.member.status !== 'paid' && viewMember.member.name && (
                   <button onClick={() => { updateMemberStatus(viewMember.service.id, viewMember.member.id, 'paid', viewMember.service.price/viewMember.service.maxSlots); setViewMember(null); }} className="w-full py-6 bg-zinc-900 text-white font-black rounded-3xl text-[12px] uppercase tracking-widest shadow-xl">Confirm Manually</button>
                 )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI VERIFICATION OVERLAYS */}
      {verifyState !== 'idle' && (
         <div className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-[4rem] overflow-hidden shadow-3xl">
               <div className="relative aspect-square w-full bg-zinc-50 overflow-hidden">
                  {verifyImage && <img src={verifyImage} className={`w-full h-full object-cover transition-all duration-1000 ${verifyState === 'scanning' ? 'opacity-20 blur-[20px] scale-110' : 'opacity-100'}`} />}
                  {verifyState === 'scanning' && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="w-full h-[2px] bg-indigo-600 absolute top-0 animate-scan shadow-[0_0_20px_rgba(79,70,229,0.4)]" />
                        <ScanLine size={80} className="text-indigo-600 opacity-20 animate-pulse" />
                        <p className="text-indigo-600 font-black uppercase tracking-[0.5em] text-[10px] mt-12 animate-pulse">Scanning Receipt Details...</p>
                     </div>
                  )}
                  {verifyState === 'success' && <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/50 animate-in zoom-in"><CheckCircle size={100} className="text-emerald-500" strokeWidth={1.5} /></div>}
                  {verifyState === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in">
                       <AlertTriangle size={80} className="text-rose-400 mb-8" />
                       <p className="text-zinc-900 font-black text-sm uppercase tracking-tight leading-relaxed">{aiMessage}</p>
                       <button onClick={() => setVerifyState('idle')} className="mt-12 border-2 border-zinc-100 px-10 py-4 rounded-full font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 transition-all">Try Again</button>
                    </div>
                  )}
               </div>
               
               <div className="p-14 text-center">
                  {verifyState === 'review' && verifyResult && (
                     <div className="space-y-10 animate-fade-in">
                        <div className="space-y-6 text-left">
                           <div>
                              <p className="text-zinc-400 font-black text-[10px] uppercase tracking-[0.3em] mb-2">Detected Amount</p>
                              <h3 className="text-5xl font-black text-zinc-900 tracking-tighter">Rp {verifyResult.amount.toLocaleString()}</h3>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                             <div>
                                <p className="text-zinc-400 font-black text-[10px] uppercase tracking-[0.3em] mb-1">Sender</p>
                                <h3 className="text-xs font-black text-zinc-900 tracking-tight capitalize truncate">{verifyResult.sender || "Unknown"}</h3>
                             </div>
                             <div>
                                <p className="text-zinc-400 font-black text-[10px] uppercase tracking-[0.3em] mb-1">Ref ID</p>
                                <h3 className="text-xs font-black text-zinc-900 tracking-tight truncate">{verifyResult.transactionId}</h3>
                             </div>
                           </div>
                           <div className="mt-6 flex items-center justify-center gap-3 px-5 py-2 border border-emerald-100 bg-emerald-50 rounded-full w-fit mx-auto">
                              <ShieldCheck size={14} className="text-emerald-600" />
                              <span className="text-emerald-600 font-black text-[9px] uppercase tracking-widest">AI Validated</span>
                           </div>
                        </div>
                        <button onClick={() => {
                             if (isPayModalOpen) updateMemberStatus(isPayModalOpen.serviceId, isPayModalOpen.memberId, 'paid', verifyResult.amount, verifyResult.sender, verifyResult.transactionId);
                             setVerifyState('success'); 
                             setTimeout(() => { setVerifyState('idle'); setIsPayModalOpen(null); }, 1500);
                        }} className="w-full bg-zinc-900 text-white font-black py-7 rounded-3xl text-[12px] uppercase tracking-widest active:scale-[0.98] shadow-2xl shadow-zinc-200">Confirm AI Result</button>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

      {loadingAI && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-3xl z-[210] flex flex-col items-center justify-center p-12 text-center animate-in fade-in">
           <div className="relative mb-12 flex items-center justify-center">
              <div className="absolute w-32 h-32 bg-indigo-50 blur-[60px] rounded-full animate-pulse"></div>
              <Sparkles className="relative w-20 h-20 text-indigo-600 animate-pulse" />
           </div>
           <h3 className="text-2xl font-black text-zinc-900 mb-2 tracking-tighter uppercase">{aiMessage}</h3>
           <p className="text-zinc-300 text-[10px] font-black uppercase tracking-[0.5em] mt-8">SubShare Intelligence Active</p>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);