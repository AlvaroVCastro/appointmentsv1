"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, BarChart3, TrendingUp, Users, Calendar, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  id: string;
  doctor_code: string;
  doctor_name: string | null;
  occupation_percentage: number;
  total_slots: number;
  occupied_slots: number;
  total_reschedules_30d: number;
  computed_at: string;
}

interface TopDoctor {
  doctor_code: string;
  doctor_name: string;
  reschedule_count: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats[]>([]);
  const [topDoctors, setTopDoctors] = useState<TopDoctor[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      // Check if user is admin and fetch stats
      const [statsResponse, topResponse] = await Promise.all([
        fetch('/api/dashboard/stats?all=true'),
        fetch('/api/dashboard/reschedules?top=true&limit=10&days=30'),
      ]);

      if (statsResponse.status === 403) {
        // Not an admin - redirect to regular dashboard
        router.push('/dashboard');
        return;
      }

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch stats');
      }

      const statsData = await statsResponse.json();
      setStats(statsData.stats || []);

      if (topResponse.ok) {
        const topData = await topResponse.json();
        setTopDoctors(topData.topDoctors || []);
      }
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados do dashboard.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getOccupationColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-600 bg-emerald-50';
    if (percentage >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  // Calculate averages
  const avgOccupation = stats.length > 0
    ? stats.reduce((sum, s) => sum + (s.occupation_percentage || 0), 0) / stats.length
    : 0;

  const totalReschedules = stats.reduce((sum, s) => sum + (s.total_reschedules_30d || 0), 0);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
          <span className="text-slate-500">A carregar dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="text-slate-500 text-sm mt-1">
                Visão geral de todos os médicos e métricas de reagendamentos
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total de Médicos</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-cyan-50 flex items-center justify-center">
                    <Users className="h-6 w-6 text-cyan-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Ocupação Média</p>
                    <p className="text-3xl font-bold text-slate-900">{avgOccupation.toFixed(1)}%</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Reagendamentos (30d)</p>
                    <p className="text-3xl font-bold text-slate-900">{totalReschedules}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-violet-50 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Slots Ocupados Hoje</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {stats.reduce((sum, s) => sum + (s.occupied_slots || 0), 0)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Occupation by Doctor */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-slate-400" />
                  <div>
                    <CardTitle className="text-base">Ocupação por Médico</CardTitle>
                    <CardDescription>Percentagem de ocupação de hoje</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {stats.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum dado disponível.</p>
                    <p className="text-sm text-slate-400 mt-1">
                      As estatísticas são atualizadas automaticamente às 7h.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {stats
                      .sort((a, b) => (b.occupation_percentage || 0) - (a.occupation_percentage || 0))
                      .map((stat) => (
                        <div
                          key={stat.doctor_code}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          onClick={() => router.push(`/dashboard?doctorCode=${stat.doctor_code}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {stat.doctor_name || 'Desconhecido'}
                            </p>
                            <p className="text-xs text-slate-500">
                              Código: {stat.doctor_code} • {stat.occupied_slots}/{stat.total_slots} slots
                            </p>
                          </div>
                          <Badge className={getOccupationColor(stat.occupation_percentage || 0)}>
                            {(stat.occupation_percentage || 0).toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* TOP 10 Reschedules */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-slate-400" />
                  <div>
                    <CardTitle className="text-base">TOP 10 Reagendamentos</CardTitle>
                    <CardDescription>Médicos com mais reagendamentos nos últimos 30 dias</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {topDoctors.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum reagendamento encontrado.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {topDoctors.map((doctor, index) => (
                      <div
                        key={doctor.doctor_code}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard?doctorCode=${doctor.doctor_code}`)}
                      >
                        <div className={`
                          h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold
                          ${index === 0 ? 'bg-amber-100 text-amber-700' : 
                            index === 1 ? 'bg-slate-200 text-slate-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-500'}
                        `}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {doctor.doctor_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Código: {doctor.doctor_code}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-violet-50 text-violet-700">
                          {doctor.reschedule_count} reagend.
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
