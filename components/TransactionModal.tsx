"use client";

import { useState, useEffect } from "react";
import { X, Check, CreditCard, Repeat, DollarSign, Home, ShoppingCart, Car, Zap, Heart, Gamepad2, Briefcase, HelpCircle, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any; // DADO PARA EDIÇÃO
}

const CATEGORIES = [
  { id: 'moradia', label: 'Moradia', icon: Home },
  { id: 'alimentacao', label: 'Alimentação', icon: ShoppingCart },
  { id: 'transporte', label: 'Transporte', icon: Car },
  { id: 'contas', label: 'Contas/Util', icon: Zap },
  { id: 'saude', label: 'Saúde', icon: Heart },
  { id: 'lazer', label: 'Lazer', icon: Gamepad2 },
  { id: 'trabalho', label: 'Receita/Trab', icon: Briefcase },
  { id: 'outros', label: 'Outros', icon: HelpCircle },
];

export default function TransactionModal({ isOpen, onClose, onSuccess, initialData }: TransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  // Form States
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("outros"); 
  const [installments, setInstallments] = useState(1); 
  const [isRecurring, setIsRecurring] = useState(false);

  // PREENCHER FORMULÁRIO SE FOR EDIÇÃO
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Modo Edição
        setDescription(initialData.description);
        setAmount(String(initialData.amount));
        setDate(initialData.date);
        setAccountId(initialData.account_id);
        setType(initialData.type);
        setCategory(initialData.category || 'outros');
        setIsRecurring(initialData.is_recurring || false);
        setInstallments(1); // Em edição, geralmente não mudamos parcelamento em massa por segurança
      } else {
        // Modo Novo (Reset)
        setDescription("");
        setAmount("");
        setDate(new Date().toISOString().split('T')[0]);
        setType("expense");
        setCategory("outros");
        setIsRecurring(false);
        setInstallments(1);
      }
      
      // Carregar Contas
      async function getAccounts() {
        const { data } = await supabase.from('accounts').select('id, name');
        if (data && data.length > 0) {
          setAccounts(data);
          // Só define padrão se não tivermos editando
          if (!initialData) setAccountId(data[0].id);
        }
      }
      getAccounts();
    }
  }, [isOpen, initialData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const val = parseFloat(amount.replace(',', '.'));
      const dayOfMonth = parseInt(date.split('-')[2]); 

      if (initialData) {
        // --- MODO UPDATE (ATUALIZAR) ---
        const { error } = await supabase
          .from('transactions')
          .update({
            description,
            amount: val,
            type,
            date,
            account_id: accountId,
            category,
            is_recurring: isRecurring
          })
          .eq('id', initialData.id);
        
        if (error) throw error;

      } else {
        // --- MODO INSERT (CRIAR NOVO) ---
        if (type === 'expense' && installments > 1) {
          // Parcelamento
          const payloads = [];
          const baseDate = new Date(date);
          const installmentValue = val / installments;
          
          for (let i = 0; i < installments; i++) {
            const futureDate = new Date(baseDate);
            futureDate.setMonth(baseDate.getMonth() + i);
            payloads.push({
              description: `${description} (${i + 1}/${installments})`,
              amount: installmentValue,
              type: 'expense',
              date: futureDate.toISOString().split('T')[0],
              account_id: accountId,
              status: 'pending',
              category: category,
              is_recurring: false
            });
          }
          await supabase.from('transactions').insert(payloads);
        } else {
          // Simples
          const { error } = await supabase.from('transactions').insert({
            description, amount: val, type, date, account_id: accountId,
            status: 'pending', category, is_recurring: isRecurring
          });
          if (error) throw error;

          // Cria Regra de Recorrência
          if (isRecurring) {
             await supabase.from('recurrences').insert({
               description, amount: val, type, account_id: accountId, day_of_month: dayOfMonth,
               active: true, category, last_generated_date: date 
             });
          }
        }
      }

      onSuccess();
      onClose();

    } catch (error) {
      console.error(error);
      alert("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#09090b] border border-zinc-800 shadow-2xl relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <h2 className="text-sm font-bold tracking-widest text-zinc-100 uppercase flex items-center gap-2">
            {initialData ? <Save className="w-4 h-4 text-primary" /> : <DollarSign className="w-4 h-4 text-primary" />} 
            {initialData ? 'Editar Operação' : 'Novo Input'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          
          {/* Tipo Toggle (Bloqueado em parcelas, liberado aqui) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded border border-zinc-800">
            <button type="button" onClick={() => setType('expense')} className={`text-xs font-mono py-2 ${type === 'expense' ? 'bg-red-500/20 text-red-500 border-red-500/20' : 'text-zinc-500'}`}>SAÍDA</button>
            <button type="button" onClick={() => setType('income')} className={`text-xs font-mono py-2 ${type === 'income' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' : 'text-zinc-500'}`}>ENTRADA</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Descrição</label>
              <input required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black border border-zinc-800 p-2 text-zinc-100 text-sm focus:border-primary outline-none" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Valor (R$)</label>
                <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black border border-zinc-800 p-2 text-zinc-100 text-sm focus:border-primary outline-none font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Vencimento</label>
                <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-black border border-zinc-800 p-2 text-zinc-100 text-sm focus:border-primary outline-none font-mono" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono mb-2 block">Categoria</label>
            <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map(cat => (
                    <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} className={`flex flex-col items-center justify-center p-2 rounded border gap-1 ${category === cat.id ? 'bg-primary/20 border-primary text-primary' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                        <cat.icon className="w-4 h-4" />
                        <span className="text-[9px] font-mono uppercase">{cat.label}</span>
                    </button>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-900">
            <div className="col-span-2">
               <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Conta</label>
               <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full bg-black border border-zinc-800 p-2 text-zinc-300 text-xs focus:border-primary outline-none">
                 {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
               </select>
            </div>

            {/* Oculta parcelas se estiver editando (para simplificar) */}
            {!initialData && type === 'expense' && (
              <>
                <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1"><CreditCard className="w-3 h-3" /> Parcelas</label>
                    <select value={installments} onChange={e => { setInstallments(Number(e.target.value)); setIsRecurring(false); }} className="w-full bg-black border border-zinc-800 p-2 text-zinc-300 text-xs focus:border-primary outline-none">
                        <option value={1}>1x</option><option value={2}>2x</option><option value={3}>3x</option><option value={6}>6x</option><option value={10}>10x</option><option value={12}>12x</option>
                    </select>
                </div>
                <div className="flex items-end">
                    <button type="button" onClick={() => { setIsRecurring(!isRecurring); setInstallments(1); }} className={`w-full p-2 border text-xs font-mono flex items-center justify-center gap-2 ${isRecurring ? 'border-primary text-primary bg-primary/10' : 'border-zinc-800 text-zinc-500'}`}>
                        <Repeat className="w-3 h-3" /> {isRecurring ? 'RECORRENTE' : 'FIXO?'}
                    </button>
                </div>
              </>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-sky-600 text-black font-bold py-3 text-sm tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? 'Salvando...' : <><Check className="w-4 h-4" /> {initialData ? 'Atualizar Dados' : 'Confirmar'}</>}
          </button>

        </form>
      </div>
    </div>
  );
}
