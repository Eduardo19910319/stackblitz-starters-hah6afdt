"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Activity, AlertTriangle, DollarSign, Hexagon, LayoutDashboard, Plus, Loader2, Trash2, CheckCircle2, Clock, 
  Home, ShoppingCart, Car, Zap, Heart, Gamepad2, Briefcase, HelpCircle, ChevronLeft, ChevronRight, CalendarDays, Target, 
  PieChart, List
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import TransactionModal from "@/components/TransactionModal";

// Mapa de Ícones
const CATEGORY_ICONS: Record<string, any> = {
  moradia: Home, alimentacao: ShoppingCart, transporte: Car, contas: Zap, saude: Heart, lazer: Gamepad2, trabalho: Briefcase, outros: HelpCircle
};

const CATEGORY_LABELS: Record<string, string> = {
  moradia: 'Moradia', alimentacao: 'Alimentação', transporte: 'Transporte', contas: 'Contas/Util', saude: 'Saúde', lazer: 'Lazer', trabalho: 'Trabalho', outros: 'Outros'
};

const CATEGORY_COLORS: Record<string, string> = {
  moradia: 'bg-blue-500', alimentacao: 'bg-orange-500', transporte: 'bg-yellow-500', contas: 'bg-purple-500', saude: 'bg-red-500', lazer: 'bg-pink-500', trabalho: 'bg-emerald-500', outros: 'bg-zinc-500'
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [globalBalance, setGlobalBalance] = useState(0);
  const [monthBalance, setMonthBalance] = useState(0);
  const [monthPending, setMonthPending] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // ESTADO DE VISÃO: 'list' ou 'analytics'
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');

  // --- NAVEGAÇÃO ---
  function changeMonth(offset: number) {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  }
  function handleDateJump(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const [year, month, day] = e.target.value.split('-');
    const newDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    setCurrentDate(newDate);
  }
  function resetToToday() { setCurrentDate(new Date()); }

  // --- AÇÕES ---
  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
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
          description: rule.description, amount: rule.amount, type: rule.type, account_id: rule.account_id,
          status: 'pending', category: rule.category || 'outros', date: dueDate.toISOString().split('T')[0], is_recurring: true
        });
        await supabase.from('recurrences').update({ last_generated_date: dueDate.toISOString().split('T')[0] }).eq('id', rule.id);
      }
    }
  }, []); 

  const refreshAll = useCallback(() => { fetchData(); }, [currentDate]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      await checkRecurrences();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

      const { data: monthTxs, error } = await supabase
        .from('transactions')
        .select(`*, accounts(name)`)
        .gte('date', startOfMonth).lte('date', endOfMonth)
        .order('date', { ascending: true });

      if (error) throw error;
      setTransactions(monthTxs || []);

      const mBalance = monthTxs?.reduce((acc: number, curr: any) => curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0);
      setMonthBalance(mBalance || 0);
      const mPending = monthTxs?.filter((t: any) => t.type === 'expense' && t.status === 'pending').reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
      setMonthPending(mPending || 0);

      const { data: allPaid } = await supabase.from('transactions').select('amount, type').eq('status', 'paid');
      const gBalance = allPaid?.reduce((acc: number, curr: any) => curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0);
      setGlobalBalance(gBalance || 0);

    } catch (err) { console.error("Falha:", err); } finally { setLoading(false); }
  }, [currentDate, checkRecurrences]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate).toUpperCase();
  const inputDateValue = currentDate.toISOString().split('T')[0];

  // --- CÁLCULOS ANALÍTICOS ---
  const expenses = transactions.filter(t => t.type === 'expense');
  const totalExpense = expenses.reduce((acc, t) => acc + Number(t.amount), 0);
  
  // Agrupar por Categoria
  const byCategory = expenses.reduce((acc: any, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {});
  
  // Ordenar Categorias (Maior para Menor)
  const sortedCategories = Object.entries(byCategory)
    .sort(([, a]: any, [, b]: any) => b - a)
    .map(([cat, val]: any) => ({
      cat, val, percent: totalExpense > 0 ? (val / totalExpense) * 100 : 0
    }));

  // Fixo vs Variável (Baseado na flag is_recurring)
  const fixedCost = expenses.filter(t => t.is_recurring).reduce((acc, t) => acc + Number(t.amount), 0);
  const variableCost = expenses.filter(t => !t.is_recurring).reduce((acc, t) => acc + Number(t.amount), 0);

  return (
    <div className="flex h-screen overflow-hidden relative z-10 text-zinc-100 font-sans">
      
      <aside className="w-16 border-r border-tactical bg-surface flex flex-col items-center py-6 hidden md:flex">
        <div className="mb-8"><Hexagon className="w-8 h-8 text-primary" strokeWidth={1.5} /></div>
        <nav className="flex flex-col gap-6 w-full">
          <button className="h-10 w-full flex items-center justify-center border-r-2 border-primary bg-primary/10 text-primary">
            <LayoutDashboard className="w-5 h-5" />
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        <header className="h-14 border-b border-tactical bg-surface/80 backdrop-blur flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
             <Hexagon className="w-6 h-6 text-primary md:hidden" strokeWidth={1.5} />
             <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 font-mono tracking-widest">SENTINEL OS</span>
                <span className="text-xs font-bold text-zinc-100 tracking-wide hidden sm:block">DASHBOARD</span>
             </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* TOGGLE DE VISÃO */}
            <div className="flex bg-zinc-900 rounded p-1 border border-zinc-800">
                <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <List className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setViewMode('analytics')}
                    className={`p-1.5 rounded transition-all ${viewMode === 'analytics' ? 'bg-primary/20 text-primary shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <PieChart className="w-4 h-4" />
                </button>
            </div>

            {/* NAVEGADOR TEMPORAL */}
            <div className="flex items-center gap-2">
                <button onClick={resetToToday} className="p-2 border border-zinc-800 bg-zinc-900 rounded-sm text-zinc-500 hover:text-primary transition-colors">
                    <Target className="w-4 h-4" />
                </button>
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-sm relative">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors z-10"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="px-2 py-1 text-xs font-mono font-bold text-zinc-200 min-w-[120px] text-center border-x border-zinc-800 flex items-center justify-center gap-2 relative group">
                        <CalendarDays className="w-3 h-3 text-primary" />
                        <span>{monthLabel}</span>
                        <input type="date" value={inputDateValue} onChange={handleDateJump} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20" />
                    </div>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors z-10"><ChevronRight className="w-4 h-4" /></button>
                </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6 pb-20">
          
          {/* CARDS GLOBAIS (Sempre Visíveis) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface/50 border border-tactical p-5 relative group hover:border-emerald-500/30 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Caixa Total</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-mono text-white tracking-tighter">
                {loading ? "..." : globalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
            
            <div className="bg-surface/50 border border-tactical p-5 relative group hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Balanço do Mês</span>
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div className={`text-3xl font-mono tracking-tighter ${monthBalance >= 0 ? 'text-zinc-200' : 'text-alert'}`}>
                 {loading ? "..." : monthBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>

            <div className="bg-surface/50 border border-tactical p-5 relative group hover:border-alert/30 transition-colors flex flex-col justify-between">
               <div className="flex justify-between items-start">
                 <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">A Pagar</span>
                    <span className="text-2xl font-mono text-alert tracking-tighter block mt-1">
                        {loading ? "..." : monthPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                 </div>
                 <AlertTriangle className="w-4 h-4 text-alert" />
               </div>
               <button onClick={() => setIsModalOpen(true)} className="w-full mt-2 py-1.5 border border-tactical bg-zinc-900 hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-300 font-bold uppercase tracking-wider">
                    <Plus className="w-3 h-3" /> Input
               </button>
            </div>
          </div>

          {/* ÁREA DINÂMICA: LISTA OU GRÁFICOS */}
          {viewMode === 'list' ? (
             <div className="border border-tactical bg-surface/30 min-h-[400px]">
                <div className="px-4 py-3 border-b border-tactical flex justify-between items-center bg-surface/50">
                <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                    <Activity className="w-3 h-3" /> Operações
                </h3>
                </div>
                
                <div className="divide-y divide-zinc-800/50">
                {loading ? ( <div className="p-8 text-center text-zinc-500 font-mono text-xs">PROCESSANDO...</div> ) 
                : transactions.length === 0 ? ( <div className="p-8 text-center text-zinc-500 font-mono text-xs opacity-50">SEM MOVIMENTAÇÃO</div> ) 
                : transactions.map((t) => {
                    const Icon = CATEGORY_ICONS[t.category] || HelpCircle;
                    const isLate = t.status === 'pending' && new Date(t.date) < new Date() && t.type === 'expense';
                    
                    return (
                    <div key={t.id} className={`px-4 py-3 grid grid-cols-12 gap-2 md:gap-4 items-center hover:bg-zinc-800/30 text-xs group transition-colors ${isLate ? 'bg-red-900/10' : ''}`}>
                        <div className="col-span-3 md:col-span-2 text-zinc-500 font-mono flex items-center gap-3">
                            <div className={`p-1.5 rounded border ${isLate ? 'border-red-900/30 bg-red-900/10 text-red-500' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}>
                                <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col">
                                <span className={`font-bold ${isLate ? 'text-red-400' : 'text-zinc-300'}`}>{t.date.split('-')[2]}</span>
                                <span className="text-[9px] uppercase">{new Date(t.date).toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0,3)}</span>
                            </div>
                        </div>
                        <div className="col-span-5 md:col-span-6 font-medium text-zinc-200">
                            {t.description} 
                            <span className="text-zinc-600 font-normal block text-[10px] flex items-center gap-1">
                            {t.is_recurring && <Clock className="w-3 h-3 text-primary" />} {t.accounts?.name}
                            </span>
                        </div>
                        <div className={`col-span-4 md:col-span-2 text-right font-mono ${t.type === 'income' ? 'text-emerald-500' : 'text-zinc-100'}`}>
                            {t.type === 'expense' ? '- ' : '+ '} {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="col-span-12 md:col-span-2 flex justify-end items-center gap-3 mt-2 md:mt-0 border-t md:border-t-0 border-zinc-800 pt-2 md:pt-0">
                            <button onClick={() => toggleStatus(t.id, t.status)} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-bold uppercase tracking-wide transition-all ${t.status === 'paid' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10' : isLate ? 'border-red-500/30 text-red-500 bg-red-500/10' : 'border-zinc-700 text-zinc-400 bg-zinc-800/50'}`}>
                            {t.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />} {t.status === 'paid' ? 'PAGO' : 'ABERTO'}
                            </button>
                            <button onClick={() => deleteTransaction(t.id)} className="text-zinc-600 hover:text-red-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                )})}
                </div>
            </div>
          ) : (
            // --- VISÃO DE ANÁLISE (DASHBOARD) ---
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                
                {/* 1. GRÁFICO DE CATEGORIAS (Barras Táticas) */}
                <div className="border border-tactical bg-surface/30 p-5">
                    <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-2 mb-6">
                        <PieChart className="w-3 h-3" /> Distribuição de Gastos
                    </h3>
                    
                    <div className="space-y-4">
                        {sortedCategories.length === 0 ? <p className="text-xs text-zinc-500">Sem dados de despesa.</p> : 
                         sortedCategories.map((item: any) => {
                             const Icon = CATEGORY_ICONS[item.cat] || HelpCircle;
                             const colorClass = CATEGORY_COLORS[item.cat] || 'bg-zinc-500';
                             
                             return (
                             <div key={item.cat}>
                                 <div className="flex justify-between items-end mb-1">
                                     <div className="flex items-center gap-2 text-zinc-300">
                                         <Icon className="w-3.5 h-3.5 text-zinc-500" />
                                         <span className="text-xs font-mono uppercase">{CATEGORY_LABELS[item.cat]}</span>
                                     </div>
                                     <div className="text-right">
                                         <span className="text-xs font-mono text-white font-bold block">{item.val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                     </div>
                                 </div>
                                 <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden flex items-center gap-1">
                                     <div className={`h-full ${colorClass}`} style={{ width: `${item.percent}%` }}></div>
                                 </div>
                                 <div className="text-[9px] text-zinc-600 text-right mt-0.5 font-mono">{item.percent.toFixed(1)}%</div>
                             </div>
                         )})}
                    </div>
                </div>

                {/* 2. GRÁFICO FIXO vs VARIÁVEL */}
                <div className="border border-tactical bg-surface/30 p-5 flex flex-col">
                    <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-2 mb-6">
                        <Activity className="w-3 h-3" /> Estrutura de Custo
                    </h3>
                    
                    <div className="flex-1 flex flex-col justify-center gap-6">
                        {/* Fixo */}
                        <div className="relative pt-4">
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-blue-400 font-mono uppercase">Custos Fixos</span>
                                <span className="text-white font-mono">{fixedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${totalExpense > 0 ? (fixedCost / totalExpense) * 100 : 0}%` }}></div>
                            </div>
                        </div>

                        {/* Variável */}
                        <div>
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-yellow-400 font-mono uppercase">Variável / Extra</span>
                                <span className="text-white font-mono">{variableCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500" style={{ width: `${totalExpense > 0 ? (variableCost / totalExpense) * 100 : 0}%` }}></div>
                            </div>
                        </div>

                        {/* Resumo */}
                        <div className="mt-4 p-3 bg-zinc-900/50 border border-zinc-800 rounded text-center">
                            <span className="text-[10px] text-zinc-500 uppercase block mb-1">Total de Saídas</span>
                            <span className="text-xl font-mono text-zinc-200">{totalExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                </div>

            </div>
          )}

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
