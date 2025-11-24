"use client";

import { useState, useEffect } from "react";
import { X, Check, Calendar, CreditCard, Repeat, DollarSign } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TransactionModal({ isOpen, onClose, onSuccess }: TransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  // Form States
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [installments, setInstallments] = useState(1); // 1 = à vista
  const [isRecurring, setIsRecurring] = useState(false);

  // Buscar contas para o select
  useEffect(() => {
    async function getAccounts() {
      const { data } = await supabase.from('accounts').select('id, name');
      if (data) {
        setAccounts(data);
        if(data.length > 0) setAccountId(data[0].id);
      }
    }
    if (isOpen) getAccounts();
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payloads = [];
      const baseDate = new Date(date);
      // Pega o dia do mês para salvar na regra de recorrência
      const dayOfMonth = parseInt(date.split('-')[2]); 
      const val = parseFloat(amount.replace(',', '.'));

      // 1. LÓGICA DE PARCELAMENTO (Gera múltiplos lançamentos futuros)
      if (type === 'expense' && installments > 1) {
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
            is_recurring: false
          });
        }
        // Inserir as parcelas
        const { error } = await supabase.from('transactions').insert(payloads);
        if (error) throw error;

      } else {
        // 2. LÓGICA À VISTA OU RECORRENTE
        
        // A. Insere a transação atual (deste mês)
        const { error: txError } = await supabase.from('transactions').insert({
          description,
          amount: val,
          type,
          date,
          account_id: accountId,
          status: 'pending',
          is_recurring: isRecurring
        });
        if (txError) throw txError;

        // B. Se for RECORRENTE, salva a regra na tabela 'recurrences'
        // Isso garante que o sistema lembre de cobrar mês que vem
        if (isRecurring) {
           const { error: recError } = await supabase.from('recurrences').insert({
             description: description,
             amount: val,
             type: type,
             account_id: accountId,
             day_of_month: dayOfMonth,
             active: true,
             last_generated_date: date // Marca que a deste mês já foi lançada
           });
           if (recError) throw recError;
        }
      }

      // Reset e Fechar
      setDescription("");
      setAmount("");
      setInstallments(1);
      setIsRecurring(false);
      onSuccess();
      onClose();

    } catch (error) {
      alert("Erro ao salvar operação.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#09090b] border border-zinc-800 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        
        {/* Header Tático */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <h2 className="text-sm font-bold tracking-widest text-zinc-100 uppercase flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Novo Lançamento
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Tipo de Operação (Toggle) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded border border-zinc-800">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`text-xs font-mono py-2 text-center transition-all ${type === 'expense' ? 'bg-red-500/20 text-red-500 border border-red-500/20 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              SAÍDA / DESPESA
            </button>
            <button
              type="button"
              onClick={() => { setType('income'); setInstallments(1); }}
              className={`text-xs font-mono py-2 text-center transition-all ${type === 'income' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              ENTRADA / RECEITA
            </button>
          </div>

          {/* Descrição e Valor */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Descrição</label>
              <input 
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-black border border-zinc-800 p-2 text-zinc-100 text-sm focus:border-primary outline-none placeholder:text-zinc-700"
                placeholder="Ex: Mercado Semanal"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Valor (R$)</label>
                <input 
                  required
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-black border border-zinc-800 p-2 text-zinc-100 text-sm focus:border-primary outline-none font-mono"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Data Venc.</label>
                <div className="relative">
                    <input 
                    required
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-black border border-zinc-800 p-2 text-zinc-100 text-sm focus:border-primary outline-none font-mono"
                    />
                </div>
              </div>
            </div>
          </div>

          {/* Configurações Avançadas (Conta, Parcelas, Recorrência) */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-900">
            
            <div className="col-span-2">
               <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Conta / Cartão</label>
               <select 
                 value={accountId}
                 onChange={e => setAccountId(e.target.value)}
                 className="w-full bg-black border border-zinc-800 p-2 text-zinc-300 text-xs focus:border-primary outline-none"
               >
                 {accounts.map(acc => (
                   <option key={acc.id} value={acc.id}>{acc.name}</option>
                 ))}
               </select>
            </div>

            {type === 'expense' && (
              <>
                <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> Parcelas
                    </label>
                    <select 
                        value={installments}
                        onChange={e => { setInstallments(Number(e.target.value)); setIsRecurring(false); }}
                        className="w-full bg-black border border-zinc-800 p-2 text-zinc-300 text-xs focus:border-primary outline-none"
                    >
                        <option value={1}>À vista (1x)</option>
                        <option value={2}>2x</option>
                        <option value={3}>3x</option>
                        <option value={6}>6x</option>
                        <option value={10}>10x</option>
                        <option value={12}>12x</option>
                    </select>
                </div>

                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={() => { setIsRecurring(!isRecurring); setInstallments(1); }}
                        className={`w-full p-2 border text-xs font-mono flex items-center justify-center gap-2 transition-colors ${
                            isRecurring ? 'border-primary text-primary bg-primary/10' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                        }`}
                    >
                        <Repeat className="w-3 h-3" /> {isRecurring ? 'É RECORRENTE' : 'FIXO / MENSAL?'}
                    </button>
                </div>
              </>
            )}
          </div>

          {/* Footer Action */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-sky-600 text-black font-bold py-3 text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? 'Processando...' : <><Check className="w-4 h-4" /> Confirmar Input</>}
          </button>

        </form>
      </div>
    </div>
  );
}