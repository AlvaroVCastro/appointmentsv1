"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Calendar, CalendarCheck, Clock, User, Search, TrendingUp, BarChart3 } from 'lucide-react';

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

interface Reschedule {
  id: string;
  doctor_code: string;
  patient_id: string;
  patient_name: string | null;
  original_datetime: string;
  new_datetime: string;
  anticipation_days: number;
  status: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  doctorCode: string | null;
  doctorCodes: string[];
  isAdmin: boolean;
  isDoctor: boolean;
  hasMultipleDoctorCodes: boolean;
}

interface WeeklyOccupancy {
  doctor_code: string;
  doctor_name: string | null;
  occupancy_percentage: number;
  period_start: string;
  period_end: string;
  total_slots: number;
  occupied_slots: number;
  days_counted: number;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const urlDoctorCode = searchParams.get('doctorCode');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weeklyOccupancy, setWeeklyOccupancy] = useState<WeeklyOccupancy | null>(null);
  const [reschedules, setReschedules] = useState<Reschedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [searchCode, setSearchCode] = useState(urlDoctorCode || '');
  const [currentDoctorCode, setCurrentDoctorCode] = useState<string | null>(urlDoctorCode);

  // Load user profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  // Load data when doctorCode changes
  useEffect(() => {
    if (currentDoctorCode) {
      loadDashboardData(currentDoctorCode);
    }
  }, [currentDoctorCode]);

  // Auto-load doctor's own data if they're a doctor (not admin) with single code
  useEffect(() => {
    if (profile && !profile.isAdmin && !profile.hasMultipleDoctorCodes && profile.doctorCode && !currentDoctorCode) {
      setCurrentDoctorCode(profile.doctorCode);
      setSearchCode(profile.doctorCode);
    }
  }, [profile, currentDoctorCode]);

  // Handle multi-code selection
  const handleMultiCodeSelection = (code: string) => {
    setCurrentDoctorCode(code);
    setSearchCode(code);
  };

  async function loadProfile() {
    try {
      const response = await fetch('/api/dashboard/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboardData(doctorCode: string) {
    setLoading(true);
    setWeeklyLoading(true);
    try {
      const [statsResponse, reschedulesResponse] = await Promise.all([
        fetch(`/api/dashboard/stats?doctorCode=${doctorCode}`),
        fetch(`/api/dashboard/reschedules?doctorCode=${doctorCode}&limit=10`),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }

      if (reschedulesResponse.ok) {
        const reschedulesData = await reschedulesResponse.json();
        setReschedules(reschedulesData.reschedules || []);
      }

      // Fetch weekly occupancy separately (can take longer)
      fetch(`/api/dashboard/occupancy?doctorCode=${doctorCode}&period=weekly`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.occupancy) {
            setWeeklyOccupancy(data.occupancy);
          }
        })
        .catch(err => console.error('Error loading weekly occupancy:', err))
        .finally(() => setWeeklyLoading(false));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCode.trim()) {
      setCurrentDoctorCode(searchCode.trim());
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOccupationColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-600';
    if (percentage >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  // Loading state
  if (loading && !profile) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
          <span className="text-slate-500">A carregar...</span>
        </div>
      </div>
    );
  }

  const isAdmin = profile?.isAdmin;
  const showMultiCodeSelector = !isAdmin && profile?.hasMultipleDoctorCodes && profile?.doctorCodes?.length > 1;
  const doctorName = stats?.doctor_name || profile?.fullName || 'Desconhecido';

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500 text-sm mt-1">
                {isAdmin 
                  ? 'Pesquise um médico para ver as suas estatísticas'
                  : 'As suas estatísticas e histórico de reagendamentos'
                }
              </p>
            </div>
            {currentDoctorCode && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => loadDashboardData(currentDoctorCode)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            )}
          </div>

          {/* Admin Search Section */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Pesquisar Médico
                </CardTitle>
                <CardDescription>
                  Introduza o código do médico para ver as suas estatísticas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex gap-3">
                  <Input
                    type="text"
                    placeholder="Ex: 12345"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button type="submit" disabled={!searchCode.trim() || loading}>
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      'Pesquisar'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Multi-code selector for users with multiple doctor codes */}
          {showMultiCodeSelector && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Selecione o Médico</CardTitle>
                <CardDescription>
                  Tem acesso a múltiplos médicos. Selecione qual pretende visualizar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={currentDoctorCode || ''} onValueChange={handleMultiCodeSelection}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Escolha um médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {profile?.doctorCodes?.map((code) => (
                      <SelectItem key={code} value={code}>
                        Código {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Doctor Info Card */}
          {currentDoctorCode && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-cyan-50 flex items-center justify-center">
                    <User className="h-8 w-8 text-cyan-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900">{doctorName}</h2>
                    <p className="text-slate-500">Código: {currentDoctorCode}</p>
                  </div>
                  {stats?.computed_at && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Última atualização</p>
                      <p className="text-sm text-slate-600">{formatDateTime(stats.computed_at)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          {currentDoctorCode && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Ocupação Hoje</p>
                      <p className={`text-3xl font-bold ${stats ? getOccupationColor(stats.occupation_percentage || 0) : 'text-slate-400'}`}>
                        {stats ? `${stats.occupied_slots}/${stats.total_slots}` : '-'}
                      </p>
                      {stats && (
                        <p className="text-xs text-slate-400 mt-1">
                          {(stats.occupation_percentage || 0).toFixed(1)}%
                        </p>
                      )}
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
                      <p className="text-3xl font-bold text-violet-600">
                        {stats?.total_reschedules_30d ?? reschedules.length}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-violet-50 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-violet-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Ocupação Semanal</p>
                      {weeklyLoading ? (
                        <div className="flex items-center gap-2 mt-1">
                          <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                          <span className="text-sm text-slate-400">A calcular...</span>
                        </div>
                      ) : (
                        <>
                          <p className={`text-3xl font-bold ${weeklyOccupancy ? getOccupationColor(weeklyOccupancy.occupancy_percentage) : 'text-slate-400'}`}>
                            {weeklyOccupancy ? `${weeklyOccupancy.occupancy_percentage.toFixed(1)}%` : '-'}
                          </p>
                          {weeklyOccupancy && (
                            <p className="text-xs text-slate-400 mt-1">
                              {weeklyOccupancy.occupied_slots}/{weeklyOccupancy.total_slots} slots ({weeklyOccupancy.days_counted} dias)
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="h-12 w-12 rounded-full bg-cyan-50 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-cyan-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reschedules History */}
          {currentDoctorCode && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-slate-400" />
                  <div>
                    <CardTitle className="text-base">Últimos 10 Reagendamentos</CardTitle>
                    <CardDescription>Histórico de reagendamentos realizados</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : reschedules.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum reagendamento encontrado.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reschedules.map((reschedule) => (
                      <div
                        key={reschedule.id}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg"
                      >
                        <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-5 w-5 text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {reschedule.patient_name || `Paciente ${reschedule.patient_id}`}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{formatDate(reschedule.original_datetime)}</span>
                            <span>→</span>
                            <span className="text-emerald-600 font-medium">
                              {formatDate(reschedule.new_datetime)}
                            </span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                          -{reschedule.anticipation_days} dias
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No doctor selected message */}
          {!currentDoctorCode && isAdmin && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Pesquise um médico para ver as suas estatísticas.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No doctor code associated message for non-admins */}
          {!currentDoctorCode && !isAdmin && profile && !profile.isDoctor && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">O seu perfil não tem um código de médico associado.</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Contacte um administrador para associar o seu código.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-slate-50">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
