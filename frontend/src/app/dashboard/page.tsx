"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Zap, Calendar, CalendarCheck, AlertCircle, CheckCircle2, Clock, Users } from 'lucide-react';

// Simulated stats for the dashboard
// In a real implementation, these would come from API calls
interface DashboardStats {
  appointmentsNext10Days: number;
  emptySlotsNext10Days: number;
  realTimeOperations: {
    callsInProgress: number;
    inQueue: number;
    scheduled: number;
    transfersToReceive: number;
  };
  confirmations: {
    date: string;
    confirmed: number;
    total: number;
    notContacted: number;
    conciliadas: number;
    simples: number;
  };
  metrics: {
    totalConfirmations: number;
    contacted: number;
    attended: number;
    notConfirmed: number;
    confirmed: number;
    rescheduled: number;
    transferredToOperator: number;
    cancelled: number;
    indeterminate: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Simulate loading stats
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = () => {
    setLoading(true);
    // Simulate API call delay
    setTimeout(() => {
      setStats({
        appointmentsNext10Days: 447,
        emptySlotsNext10Days: 86,
        realTimeOperations: {
          callsInProgress: 0,
          inQueue: 0,
          scheduled: 0,
          transfersToReceive: 447,
        },
        confirmations: {
          date: 'Quarta. 7 Jan',
          confirmed: 306,
          total: 308,
          notContacted: 2,
          conciliadas: 86,
          simples: 222,
        },
        metrics: {
          totalConfirmations: 308,
          contacted: 306,
          attended: 264,
          notConfirmed: 30,
          confirmed: 233,
          rescheduled: 22,
          transferredToOperator: 0,
          cancelled: 9,
          indeterminate: 0,
        },
      });
      setLoading(false);
      setLastUpdated(new Date());
    }, 500);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500 text-sm mt-1">
                Monitorização em tempo real e análise histórica
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={loadStats}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Real-time Operations Section */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-base font-semibold">Operações em Tempo Real</CardTitle>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                  label="Chamadas em Progresso"
                  value={stats?.realTimeOperations.callsInProgress ?? 0}
                  color="cyan"
                  icon={<Clock className="h-4 w-4" />}
                />
                <StatCard
                  label="Em Fila"
                  value={stats?.realTimeOperations.inQueue ?? 0}
                  color="amber"
                  icon={<Users className="h-4 w-4" />}
                />
                <StatCard
                  label="Agendadas"
                  value={stats?.realTimeOperations.scheduled ?? 0}
                  color="violet"
                  icon={<CalendarCheck className="h-4 w-4" />}
                />
                <StatCard
                  label="Transferências p/ Receber"
                  value={stats?.realTimeOperations.transfersToReceive ?? 0}
                  color="rose"
                  icon={<AlertCircle className="h-4 w-4" />}
                />
              </div>
            </CardContent>
          </Card>

          {/* Confirmations Overview */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-slate-500">
                  Confirmações para {stats?.confirmations.date || 'Quarta. 7 Jan'}
                </p>
                <div className="text-4xl font-bold text-slate-900">
                  <span className="text-cyan-600">{stats?.confirmations.confirmed ?? 306}</span>
                  <span className="text-slate-400">/</span>
                  <span>{stats?.confirmations.total ?? 308}</span>
                </div>
                <p className="text-xs text-slate-400">
                  {stats?.confirmations.notContacted ?? 2} não contactados
                </p>
                <div className="flex items-center justify-center gap-6 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-cyan-500"></span>
                    <span className="text-sm text-slate-600">Conciliadas: {stats?.confirmations.conciliadas ?? 86}</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                    <span className="text-sm text-slate-600">Simples: {stats?.confirmations.simples ?? 222}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirmations Metrics Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-400" />
                  <div>
                    <CardTitle className="text-base font-semibold">Confirmações</CardTitle>
                    <CardDescription>Métricas de confirmações de consultas</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(lastUpdated)} — {formatDate(lastUpdated)}</span>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <MetricCard
                  label="Total de Confirmações"
                  value={stats?.metrics.totalConfirmations ?? 308}
                  color="slate"
                />
                <MetricCard
                  label="Contactadas"
                  value={stats?.metrics.contacted ?? 306}
                  color="cyan"
                />
                <MetricCard
                  label="Atendidas"
                  value={stats?.metrics.attended ?? 264}
                  color="emerald"
                />
                <MetricCard
                  label="Não Confirmadas"
                  value={stats?.metrics.notConfirmed ?? 30}
                  color="rose"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricCard
                  label="Confirmadas"
                  value={stats?.metrics.confirmed ?? 233}
                  color="emerald"
                />
                <MetricCard
                  label="Remarcadas"
                  value={stats?.metrics.rescheduled ?? 22}
                  color="amber"
                />
                <MetricCard
                  label="Transferidas p/ Operador"
                  value={stats?.metrics.transferredToOperator ?? 0}
                  color="violet"
                />
                <MetricCard
                  label="Canceladas"
                  value={stats?.metrics.cancelled ?? 9}
                  color="rose"
                />
                <MetricCard
                  label="Indeterminadas"
                  value={stats?.metrics.indeterminate ?? 0}
                  color="amber"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: 'cyan' | 'amber' | 'violet' | 'rose' | 'emerald' | 'slate';
  icon: React.ReactNode;
}

function StatCard({ label, value, color, icon }: StatCardProps) {
  const colorClasses = {
    cyan: 'text-cyan-600',
    amber: 'text-amber-600',
    violet: 'text-violet-600',
    rose: 'text-rose-600',
    emerald: 'text-emerald-600',
    slate: 'text-slate-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={`${colorClasses[color]} opacity-50`}>{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  color: 'cyan' | 'amber' | 'violet' | 'rose' | 'emerald' | 'slate';
}

function MetricCard({ label, value, color }: MetricCardProps) {
  const colorClasses = {
    cyan: 'text-cyan-600',
    amber: 'text-amber-600',
    violet: 'text-violet-600',
    rose: 'text-rose-600',
    emerald: 'text-emerald-600',
    slate: 'text-slate-900',
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 text-center">
      <p className="text-sm text-slate-500 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}

