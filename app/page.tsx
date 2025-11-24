"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Activity, AlertTriangle, DollarSign, Hexagon, LayoutDashboard, Plus, Loader2, Trash2, CheckCircle2, Clock, 
  Home, ShoppingCart, Car, Zap, Heart, Gamepad2, Briefcase, HelpCircle, ChevronLeft, ChevronRight, CalendarDays, Target, 
  PieChart, List, TrendingUp, Upload, Pencil
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import TransactionModal from "@/components/TransactionModal";

const CATEGORY_ICONS: Record<string, any> = { moradia: Home, alimentacao: ShoppingCart, transporte: Car, contas: Zap, saude: Heart, lazer: Gamepad2, trabalho: Briefcase, outros: HelpCircle };
const CATEGORY_COLORS: Record<string, string> = { moradia: 'bg-blue-500', alimentacao: 'bg-orange-500', transporte: 'bg-yellow-500', contas: 'bg-purple-500', saude: 'bg-red-500', lazer: 'bg-pink-500', trabalho: 'bg-emerald-500', outros: 'bg-zinc-500' };
const CATEGORY_LABELS: Record<string, string> = { moradia: 'Moradia', alimentacao: 'Alimentação', transporte: 'Transporte', contas: 'Contas', saude: 'Saúde', lazer: 'Lazer', trabalho: 'Trabalho', outros: 'Outros' };

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [globalBalance, setGlobalBalance] = useState(0);
  const [monthBalance, setMonthBalance] = useState(0);
  const [monthPending, setMonthPending] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // MODAL & EDIÇÃO
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null); // Guarda os dados para edição

  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');

  // --- FUNÇÕES ---
  function changeMonth(offset: number) {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  }
  function handleDateJump(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const [year, month, day] = e.target.value.split('-');
    setCurrentDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
  }
  function resetToToday() { setCurrentDate(new Date()); }

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

  // ABRIR MODAL DE EDIÇÃO
  function handleEdit(transaction: any) {
    setEditData(transaction);
    setIsModalOpen(true);
  }

  // ABRIR MODAL NOVO
  function handleNew() {
    setEditData(null); // Limpa edição anterior
    setIsModalOpen(true);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const payloads = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [date, description, amount, category, type] = line.split(',');
        if (date && description && amount) {
          payloads.push({
            date: date.trim(), description: description.trim(), amount: parseFloat(amount),
            category: (category?.trim() || 'outros').toLowerCase(), type: (type?.trim() || 'expense').toLowerCase(),
            status: 'paid', is_recurring: false
          });
        }
      }
      if (payloads.length > 0) {
        setLoading(true);
        const { error } = await supabase.from('transactions').insert(payloads);
        if (error) alert("Erro: " + error.message);
        else { alert("Importado!"); refreshAll(); }
        setLoading(false);
      }
    };
    reader.readAsText(file);
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

      const { data: monthTxs } = await supabase.from('transactions').select(`*, accounts(name)`).gte('date', startOfMonth).lte('date', endOfMonth).order('date', { ascending: true });
      setTransactions(monthTxs || []);

      const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      const startOfHistory = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1).toISOString();
      const { data: historyTxs } = await supabase.from('transactions').select('date, amount, type').gte('date', startOfHistory).order('date', { ascending: true });

      const chartMap: Record<string, { income: number, expense: number }> = {};
      historyTxs?.forEach(t => {
          const key = t.date.slice(0, 7);
          if (!chartMap[key]) chartMap[key] = { income: 0, expense: 0 };
          if (t.type === 'income') chartMap[key].income += Number(t.amount); else chartMap[key].expense += Number(t.amount);
      });
      setHistoryData(Object.entries(chartMap).sort().map(([date, val]) => ({ label: date.split('-')[1], ...val })));

      const mBalance = monthTxs?.reduce((acc: number, curr: any) => curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0);
      setMonthBalance(mBalance || 0);
      const mPending = monthTxs?.filter((t: any) => t.type === 'expense' && t.status === 'pending').reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
      setMonthPending(mPending || 0);
      const { data: allPaid } = await supabase.from('transactions').select('amount, type').eq('status', 'paid');
      const gBalance = allPaid?.reduce((acc: number, curr: any) => curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0);
      setGlobalBalance(gBalance || 0);

    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [currentDate, checkRecurrences]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate).toUpperCase();
  const inputDateValue = currentDate.toISOString().split('T')[0];
  const expenses = transactions.filter(t => t.type === 'expense');
  const totalExpense = expenses.reduce((acc, t) => acc + Number(t.amount), 0);
  const byCategory = expenses.reduce((acc: any, t) => { acc[t.category] = (acc[t.category] || 0) + Number(t.amount); return acc; }, {});
  const sortedCategories = Object.entries(byCategory).sort(([, a]: any, [, b]: any) => b - a).map(([cat, val]: any) => ({ cat, val, percent: totalExpense > 0 ? (val / totalExpense) * 100 : 0 }));
  const maxChartVal = Math.max(...historyData.map(d => Math.max(d.income, d.expense)), 100);
  const getH = (val: number) => Math.max((val / maxChartVal) * 100, 2);

  return (
    <div className="flex h-screen overflow-hidden relative z-10 text-zinc-100 font-sans">
      <aside className="w-16 border-r border-tactical bg-surface flex flex-col items-center py-6 hidden md:flex">
        <div className="mb-8"><Hexagon className="w-8 h-8 text-primary" strokeWidth={1.5} /></div>
        <nav className="flex flex-col gap-6 w-full">
          <button className="h-10 w-full flex items-center justify-center border-r-2 border-primary bg-primary/10 text-primary"><LayoutDashboard className="w-5 h-5" /></button>
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
            <div className="relative">
                <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
                <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded hover:border-zinc-600 transition-colors text-xs font-mono text-zinc-400"><Upload className="w-3 h-3" /><span className="hidden sm:inline">CSV</span></button>
            </div>
            <div className="flex bg-zinc-900 rounded p-1 border border-zinc-800">
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500'}`}><List className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('analytics')} className={`p-1.5 rounded transition-all ${viewMode === 'analytics' ? '
