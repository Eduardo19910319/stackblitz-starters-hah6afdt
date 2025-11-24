"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Activity, AlertTriangle, DollarSign, Hexagon, LayoutDashboard, Plus, Loader2, Trash2, CheckCircle2, Clock, 
  Home, ShoppingCart, Car, Zap, Heart, Gamepad2, Briefcase, HelpCircle, ChevronLeft, ChevronRight, CalendarDays
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import TransactionModal from "@/components/TransactionModal";

// Mapa de Ícones
const CATEGORY_ICONS: Record<string, any> = {
  moradia: Home,
  alimentacao: ShoppingCart,
  transporte: Car,
  contas: Zap,
  saude: Heart,
  lazer: Gamepad2,
  trabalho: Briefcase,
  outros: HelpCircle
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [globalBalance, setGlobalBalance] = useState(0); // Saldo Real (Banco)
  const [monthBalance, setMonthBalance] = useState(0);   // Sobra do Mês
  const [monthPending, setMonthPending] = useState(0);   // A Pagar no Mês
  const [currentDate, setCurrentDate] = useState(new Date()); // Data do Filtro
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- NAVEGAÇÃO TEMPORAL ---
  function changeMonth(offset: number) {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  }

  // --- AÇÕES ---
  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    // Otimista
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    await supabase.from('transactions').update({ status: newStatus }).eq('id', id);
    refreshAll(); 
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Confirmar exclusão?")) return;
    setTransactions(prev => prev.filter(t => t.id !== id));
    await supabase.from('transactions').delete().eq('id', id);
    refreshAll();
  }

  // --- BUSCA DE DADOS ---
  
  // 1. Motor de Recorrência (Roda sempre baseado no HOJE real)
  const checkRecurrences = useCallback(async () => {
    const { data: rules } = await supabase.from('recurrences').select('*').eq('active', true);
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
          category: rule.category || 'outros',
          date: dueDate.toISOString().split('T')[0],
          is_recurring: true
        });
        await supabase.from('recurrences').update({ last_generated_date: dueDate.toISOString().split('T')[0] }).eq('id', rule.id);
      }
    }
  }, []); 

  const refreshAll = useCallback(() => {
    fetchData();
  }, [currentDate]); // Recarrega se mudar a data

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      await checkRecurrences();

      // Datas de Início e Fim do Mês Selecionado
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

      // A. Busca Transações do MÊS (Lista)
      const { data: monthTxs, error } = await supabase
        .from('transactions')
        .select(`*, accounts(name)`)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .order('date', { ascending: true }); // Ordem cronológica para contas

      if (error) throw error;
      setTransactions(monthTxs || []);

      // B. Calcula Métricas do MÊS
      const mBalance = monthTxs?.reduce((acc: number, curr: any) => {
        return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
      }, 0);
      setMonthBalance(mBalance || 0);

      const mPending = monthTxs?.filter((t: any) => t.type === 'expense' && t.status === 'pending')
        .reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
      setMonthPending(mPending || 0);

      // C. Busca Saldo GLOBAL (Tudo que já foi pago na história)
      // Nota: Em app real, ideal é ter tabela de saldo, mas aqui somamos o histórico
      const { data: allPaid } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('status', 'paid');
      
      const gBalance = allPaid?.reduce((acc: number, curr: any) => {
        return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
      }, 0);
      setGlobalBalance(gBalance || 0);

    } catch (err) {
      console.error("Falha:", err);
    } finally {
      setLoading(false);
    }
  }, [currentDate, checkRecurrences]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Formatador de Data (Ex: "NOVEMBRO 2025")
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(currentDate).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden relative z-10 text-zinc-100 font-sans">
      
      {/* SIDEBAR (Desktop) */}
      <aside className="w-16 border-r border-tactical bg-surface flex flex-col items-center py-6 hidden md:flex">
        <div className="mb-8"><Hexagon className="w-8 h-8 text-primary" strokeWidth={1.5} /></div>
        <nav className="flex flex-col gap-6 w-full">
          <button className="h-10 w-full flex items-center justify-center border-r-2 border-primary bg-primary/10 text-primary">
            <LayoutDashboard className="w-5 h-5" />
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* HEADER */}
        <header className="h-14 border-b border-tactical bg-surface/80 backdrop-blur flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
             <Hexagon className="w-6 h-6 text-primary md:hidden" strokeWidth={1.5} />
             <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 font-mono tracking-widest">SENTINEL OS</span>
                <span className="text-xs font-bold text-zinc-100 tracking-wide hidden sm:block">DASHBOARD FINANCEIRO</span>
             </div>
          </div>

          {/* NAVEGADOR TEMPORAL */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-sm">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 py-1 text-xs font-mono font-bold text-zinc-200 min-w-[140px] text-center border-x border-zinc-800 flex items-center justify-center gap-2">
                <CalendarDays className="w-3 h-3 text-primary" />
                {monthLabel}
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6 pb-20">
          
          {/* CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Card 1: GLOBAL (Banco) */}
            <div className="bg-surface/50 border border-tactical p-5 relative group hover:border-emerald-500/30 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Caixa Total (Real)</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-mono text-white tracking-tighter">
                {loading ? "..." : globalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="mt-2 text-[10px] text-zinc-500 font-mono">Disponível em contas</div>
            </div>
            
            {/* Card 2: RESULTADO DO MÊS */}
            <div className="bg-surface/50 border border-tactical p-5 relative group hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Balanço do Mês</span>
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div className={`text-3xl font-mono tracking-tighter ${monthBalance >= 0 ? 'text-zinc-200' : 'text-alert'}`}>
                 {loading ? "..." : monthBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="mt-2 text-[10px] text-zinc-500 font-mono">Entradas - Saídas (Previsto)</div>
            </div>

            {/* Card 3: PENDENTE */}
            <div className="bg-surface/50 border border-tactical p-5 relative group hover:border-alert/30 transition-colors">
               <div className="flex justify-between items-start mb-2">
                 <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">A Pagar (Este Mês)</span>
                 <AlertTriangle className="w-4 h-4 text-alert" />
               </div>
               <div className="text-3xl font-mono text-alert tracking-tighter">
                  {loading ? "..." : monthPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
               </div>
               
               {/* Botão Novo Input */}
               <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full mt-3 py-2 border border-tactical bg-zinc-900 hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-300 font-bold uppercase tracking-wider"
                >
                    <Plus className="w-3 h-3" /> Adicionar
               </button>
            </div>
          </div>

          {/* LISTA DE TRANSAÇÕES */}
          <div className="border border-tactical bg-surface/30 min-h-[400px]">
            <div className="px-4 py-3 border-b border-tactical flex justify-between items-center bg-surface/50">
              <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                <Activity className="w-3 h-3" /> Operações de {monthLabel.split(' ')[0]}
              </h3>
            </div>
            
            <div className="divide-y divide-zinc-800/50">
               {loading ? (
                 <div className="p-8 text-center text-zinc-500 font-mono text-xs">PROCESSANDO...</div>
               ) : transactions.length === 0 ? (
                 <div className="p-8 text-center text-zinc-500 font-mono text-xs opacity-50">SEM MOVIMENTAÇÃO NESTE PERÍODO</div>
               ) : transactions.map((t) => {
                 const Icon = CATEGORY_ICONS[t.category] || HelpCircle;
                 const isLate = t.status === 'pending' && new Date(t.date) < new Date() && t.type === 'expense';
                 
                 return (
                 <div key={t.id} className={`px-4 py-3 grid grid-cols-12 gap-2 md:gap-4 items-center hover:bg-zinc-800/30 text-xs group transition-colors ${isLate ? 'bg-red-900/10' : ''}`}>
                    
                    {/* DATA + ÍCONE */}
                    <div className="col-span-3 md:col-span-2 text-zinc-500 font-mono flex items-center gap-3">
                        <div className={`p-1.5 rounded border ${isLate ? 'border-red-900/30 bg-red-900/10 text-red-500' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}>
                           <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col">
                           <span className={`font-bold ${isLate ? 'text-red-400' : 'text-zinc-300'}`}>{t.date.split('-')[2]}</span>
                           <span className="text-[9px] uppercase">{new Date(t.date).toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0,3)}</span>
                        </div>
                    </div>

                    {/* DESCRIÇÃO */}
                    <div className="col-span-5 md:col-span-6 font-medium text-zinc-200">
                        {t.description} 
                        <span className="text-zinc-600 font-normal block text-[10px] flex items-center gap-1">
                          {t.is_recurring && <Clock className="w-3 h-3 text-primary" />} 
                          {t.accounts?.name}
                        </span>
                    </div>

                    {/* VALOR */}
                    <div className={`col-span-4 md:col-span-2 text-right font-mono ${t.type === 'income' ? 'text-emerald-500' : 'text-zinc-100'}`}>
                        {t.type === 'expense' ? '- ' : '+ '}
                        {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>

                    {/* CONTROLES */}
                    <div className="col-span-12 md:col-span-2 flex justify-end items-center gap-3 mt-2 md:mt-0 border-t md:border-t-0 border-zinc-800 pt-2 md:pt-0">
                        <button 
                            onClick={() => toggleStatus(t.id, t.status)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-bold uppercase tracking-wide transition-all ${
                            t.status === 'paid' 
                                ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' 
                                : isLate 
                                    ? 'border-red-500/30 text-red-500 bg-red-500/10 hover:bg-red-500/20'
                                    : 'border-zinc-700 text-zinc-400 bg-zinc-800/50 hover:bg-zinc-700'
                            }`}
                        >
                          {t.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {t.status === 'paid' ? 'PAGO' : 'ABERTO'}
                        </button>

                        <button onClick={() => deleteTransaction(t.id)} className="text-zinc-600 hover:text-red-500 transition-colors p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                 </div>
               )})}
            </div>
          </div>
        </div>

        <TransactionModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => refreshAll()}
        />

      </main>
    </div>
  );
}
