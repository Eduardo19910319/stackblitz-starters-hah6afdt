"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, AlertTriangle, DollarSign, Hexagon, LayoutDashboard, Plus, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import TransactionModal from "@/components/TransactionModal";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [burnRate, setBurnRate] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const checkRecurrences = useCallback(async () => {
    const { data: rules } = await supabase
      .from('recurrences')
      .select('*')
      .eq('active', true);

    if (!rules || rules.length === 0) return;

    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7);

    for (const rule of rules) {
      const lastGen = rule.last_generated_date ? rule.last_generated_date.slice(0, 7) : '';
      
      if (lastGen !== currentMonthStr) {
        const dueDate = new Date(today.getFullYear(), today.getMonth(), rule.day_of_month);
        
        await supabase.from('transactions').insert({
          description: rule.description,
          amount: rule.amount,
          type: rule.type,
          account_id: rule.account_id,
          status: 'pending',
          date: dueDate.toISOString().split('T')[0],
          is_recurring: true
        });

        await supabase.from('recurrences')
          .update({ last_generated_date: dueDate.toISOString().split('T')[0] })
          .eq('id', rule.id);
      }
    }
  }, []); 

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      await checkRecurrences();

      const { data: txs, error } = await supabase
        .from('transactions')
        .select(`*, accounts(name)`)
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(txs || []);

      const total = txs?.reduce((acc: number, curr: any) => {
        return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
      }, 0);
      setBalance(total || 0);

      const burn = txs?.filter((t: any) => t.type === 'expense' && t.status === 'pending')
        .reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
      setBurnRate(burn || 0);

    } catch (err) {
      console.error("Falha na conexão:", err);
    } finally {
      setLoading(false);
    }
  }, [checkRecurrences]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex h-screen overflow-hidden relative z-10 text-zinc-100">
      
      <aside className="w-16 border-r border-tactical bg-surface flex flex-col items-center py-6">
        <div className="mb-8">
          <Hexagon className="w-8 h-8 text-primary" strokeWidth={1.5} />
        </div>
        <nav className="flex flex-col gap-6 w-full">
          <button className="h-10 w-full flex items-center justify-center border-r-2 border-primary bg-primary/10 text-primary">
            <LayoutDashboard className="w-5 h-5" />
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-14 border-b border-tactical bg-surface/80 backdrop-blur flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold tracking-widest text-zinc-100">SENTINEL <span className="text-zinc-600">//</span> OVERVIEW</h1>
            <span className="px-2 py-0.5 rounded-sm bg-success/10 border border-success/20 text-[10px] text-success font-mono tracking-wider">
              ONLINE
            </span>
          </div>
          <div className="font-mono text-xs text-zinc-500">ADMIN_USER</div>
        </header>

        <div className="flex-1 overflow-auto p-6 space-y-6 pb-20">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface/50 border border-tactical p-5 relative group hover:border-primary/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Saldo Global</span>
                <DollarSign className="w-4 h-4 text-zinc-600" />
              </div>
              <div className="text-3xl font-mono text-white tracking-tighter">
                {loading ? <Loader2 className="animate-spin w-6 h-6" /> : 
                  balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
            
            <div className="bg-surface/50 border border-tactical p-5 relative group hover:border-alert/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Risco Pendente</span>
                <AlertTriangle className="w-4 h-4 text-alert" />
              </div>
              <div className="text-3xl font-mono text-white tracking-tighter">
                 {loading ? "..." : burnRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
                <button className="flex-1 border border-tactical bg-zinc-900 hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 text-xs font-mono text-zinc-300">
                    <Upload className="w-4 h-4" /> IMPORTAR OFX
                </button>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex-1 border border-tactical bg-primary/10 hover:bg-primary/20 border-primary/20 transition-colors flex items-center justify-center gap-2 text-xs font-mono text-primary"
                >
                    <Plus className="w-4 h-4" /> NOVO LANÇAMENTO
                </button>
            </div>
          </div>

          <div className="border border-tactical bg-surface/30 min-h-[400px]">
            <div className="px-4 py-3 border-b border-tactical flex justify-between items-center bg-surface/50">
              <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                <Activity className="w-3 h-3" /> Feed de Operações
              </h3>
            </div>
            
            <div className="divide-y divide-zinc-800/50">
               {loading ? (
                 <div className="p-8 text-center text-zinc-500 font-mono text-xs">BUSCANDO DADOS...</div>
               ) : transactions.length === 0 ? (
                 <div className="p-8 text-center text-zinc-500 font-mono text-xs">NENHUM REGISTRO ENCONTRADO</div>
               ) : transactions.map((t) => (
                 <div key={t.id} className="px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-zinc-800/30 text-xs group cursor-pointer">
                    <div className="col-span-2 text-zinc-500 font-mono">{t.date && t.date.split('-').reverse().slice(0, 2).join('/')}</div>
                    <div className="col-span-6 font-medium text-zinc-200">
                        {t.description} 
                        <span className="text-zinc-600 font-normal block text-[10px]">
                          {t.is_recurring && '🔄'} {t.accounts?.name || 'Conta Manual'}
                        </span>
                    </div>
                    <div className={`col-span-2 text-right font-mono ${t.type === 'income' ? 'text-success' : 'text-alert'}`}>
                        {t.type === 'expense' ? '- ' : '+ '}
                        {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-2 flex justify-end">
                        <span className={`text-[9px] px-1.5 py-0.5 border rounded uppercase ${
                          t.status === 'paid' ? 'border-success/20 text-success bg-success/10' : 
                          t.status === 'late' ? 'border-alert/20 text-alert bg-alert/10' :
                          'border-zinc-700 text-zinc-500'
                        }`}>
                          {t.status}
                        </span>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <TransactionModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => fetchData()}
        />

      </main>
    </div>
  );
}