"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, BarChart3, TrendingUp, Users, Calendar, AlertCircle, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardFilters, FilterState, FilterOptions } from '@/components/admin/dashboard-filters';
import { exportDoctorsToExcel } from '@/lib/export-utils';

interface DashboardStats {
  id: string;
  doctor_code: string;
  doctor_name: string | null;
  occupation_percentage: number;
  total_slots: number;
  occupied_slots: number;
  total_reschedules_30d: number;
  computed_at: string;
  // Monthly occupation fields
  monthly_occupation_percentage: number | null;
  monthly_total_slots: number | null;
  monthly_occupied_slots: number | null;
  monthly_days_counted: number | null;
}

interface TopDoctor {
  doctor_code: string;
  doctor_name: string;
  reschedule_count: number;
}

interface MonthlyOccupancy {
  occupancy_percentage: number;
  period_start: string;
  period_end: string;
  total_slots: number;
  occupied_slots: number;
  days_counted: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats[]>([]);
  const [topDoctors, setTopDoctors] = useState<TopDoctor[]>([]);
  const [monthlyOccupancy, setMonthlyOccupancy] = useState<MonthlyOccupancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({ clinic: null, doctorCode: null });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ clinics: [], doctors: [] });

  // Load filter options on mount
  useEffect(() => {
    fetch('/api/dashboard/filters')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setFilterOptions({
            clinics: data.clinics || [],
            doctors: data.doctors || [],
          });
        }
      })
      .catch(err => console.error('Error loading filter options:', err));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMonthlyLoading(true);
    try {
      // Build query params with filters
      const statsParams = new URLSearchParams({ all: 'true' });
      if (filters.clinic) {
        statsParams.set('clinic', filters.clinic);
      }

      // Check if user is admin and fetch stats
      const [statsResponse, topResponse] = await Promise.all([
        fetch(`/api/dashboard/stats?${statsParams.toString()}`),
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

      // Fetch monthly occupancy separately (can take longer due to many API calls)
      fetch('/api/dashboard/occupancy?period=monthly&all=true')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.occupancy) {
            setMonthlyOccupancy(data.occupancy);
          }
        })
        .catch(err => console.error('Error loading monthly occupancy:', err))
        .finally(() => setMonthlyLoading(false));
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
  }, [filters.clinic, router, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter stats by doctor code (client-side filter)
  const filteredStats = useMemo(() => {
    if (!filters.doctorCode) return stats;
    return stats.filter(stat => stat.doctor_code === filters.doctorCode);
  }, [stats, filters.doctorCode]);

  const getOccupationColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-600 bg-emerald-50';
    if (percentage >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getOccupationTextColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-600';
    if (percentage >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  // Calculate averages (using filtered stats)
  const avgOccupation = filteredStats.length > 0
    ? filteredStats.reduce((sum, s) => sum + (s.occupation_percentage || 0), 0) / filteredStats.length
    : 0;

  const totalReschedules = filteredStats.reduce((sum, s) => sum + (s.total_reschedules_30d || 0), 0);

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
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Visão geral de todos os médicos e métricas de reagendamentos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => exportDoctorsToExcel(filteredStats)}
                  disabled={loading || filteredStats.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar Dados
                </Button>
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
            </div>

            {/* Filters */}
            <DashboardFilters
              filters={filters}
              options={filterOptions}
              onFiltersChange={setFilters}
              loading={loading}
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total de Médicos</p>
                    <p className="text-3xl font-bold text-slate-900">{filteredStats.length}</p>
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
                    <p className="text-sm text-slate-500">Ocupação Mensal</p>
                    {monthlyLoading ? (
                      <div className="flex items-center gap-2 mt-1">
                        <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                        <span className="text-sm text-slate-400">A calcular...</span>
                      </div>
                    ) : (
                      <>
                        <p className={`text-3xl font-bold ${monthlyOccupancy ? getOccupationTextColor(monthlyOccupancy.occupancy_percentage) : 'text-slate-400'}`}>
                          {monthlyOccupancy ? `${monthlyOccupancy.occupancy_percentage.toFixed(1)}%` : '-'}
                        </p>
                        {monthlyOccupancy && (
                          <p className="text-xs text-slate-400 mt-1">
                            {monthlyOccupancy.days_counted} dias úteis
                          </p>
                        )}
                      </>
                    )}
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
                {filteredStats.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum dado disponível.</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {filters.clinic || filters.doctorCode
                        ? 'Tente ajustar os filtros.'
                        : 'As estatísticas são atualizadas automaticamente às 7h.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {filteredStats
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
