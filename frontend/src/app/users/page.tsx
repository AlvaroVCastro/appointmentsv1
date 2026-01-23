"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, RefreshCw, Shield, ShieldOff, Pencil, Check, X, Plus, Trash2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: 'admin' | 'user';
  doctor_code: string | null;
  additional_codes: string[]; // Codes from user_doctor_codes table
  avatar_url: string | null;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [editingDoctorCode, setEditingDoctorCode] = useState<string | null>(null);
  const [doctorCodeInput, setDoctorCodeInput] = useState<string>('');
  const [addingCodeUserId, setAddingCodeUserId] = useState<string | null>(null);
  const [newCodeInput, setNewCodeInput] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      // Fetch all user profiles (RLS allows admins to see all)
      const { data: profiles, error } = await supabase
        .schema('appointments_app')
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os utilizadores. Verifique se tem permissões de admin.',
          variant: 'destructive',
        });
        return;
      }

      // Fetch additional doctor codes for all users
      const { data: additionalCodes } = await supabase
        .schema('appointments_app')
        .from('user_doctor_codes')
        .select('user_id, doctor_code');

      // Build a map of user_id -> additional codes
      const additionalCodesMap = new Map<string, string[]>();
      for (const row of additionalCodes || []) {
        const existing = additionalCodesMap.get(row.user_id) || [];
        existing.push(row.doctor_code);
        additionalCodesMap.set(row.user_id, existing);
      }

      // Merge additional codes into profiles
      const usersWithCodes = (profiles || []).map(profile => ({
        ...profile,
        additional_codes: additionalCodesMap.get(profile.id) || [],
      }));

      setUsers(usersWithCodes);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRole(userId: string, currentRole: 'admin' | 'user') {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    setUpdatingUserId(userId);
    try {
      const response = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: 'Erro',
          description: result.error || 'Não foi possível alterar o role.',
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast({
        title: 'Sucesso',
        description: `Utilizador ${newRole === 'admin' ? 'promovido a Admin' : 'removido de Admin'}.`,
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar o role.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function updateDoctorCode(userId: string) {
    const newDoctorCode = doctorCodeInput.trim() || null;
    
    setUpdatingUserId(userId);
    try {
      const response = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, doctorCode: newDoctorCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: 'Erro',
          description: result.error || 'Não foi possível atualizar o código de médico.',
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, doctor_code: newDoctorCode } : u
      ));

      toast({
        title: 'Sucesso',
        description: newDoctorCode 
          ? `Código de médico atualizado para ${newDoctorCode}.`
          : 'Código de médico removido.',
      });

      // Close edit mode
      setEditingDoctorCode(null);
      setDoctorCodeInput('');
    } catch (error) {
      console.error('Error updating doctor code:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar o código de médico.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  }

  function startEditingDoctorCode(user: UserProfile) {
    setEditingDoctorCode(user.id);
    setDoctorCodeInput(user.doctor_code || '');
  }

  function cancelEditingDoctorCode() {
    setEditingDoctorCode(null);
    setDoctorCodeInput('');
  }

  async function addDoctorCode(userId: string) {
    const codeToAdd = newCodeInput.trim();
    if (!codeToAdd) return;
    
    setUpdatingUserId(userId);
    try {
      const response = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, addDoctorCode: codeToAdd }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: 'Erro',
          description: result.error || 'Não foi possível adicionar o código.',
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId 
          ? { ...u, additional_codes: [...u.additional_codes, codeToAdd] }
          : u
      ));

      toast({
        title: 'Sucesso',
        description: `Código ${codeToAdd} adicionado.`,
      });

      // Close add mode
      setAddingCodeUserId(null);
      setNewCodeInput('');
    } catch (error) {
      console.error('Error adding doctor code:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao adicionar o código.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function removeDoctorCode(userId: string, codeToRemove: string) {
    setUpdatingUserId(userId);
    try {
      const response = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, removeDoctorCode: codeToRemove }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: 'Erro',
          description: result.error || 'Não foi possível remover o código.',
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId 
          ? { ...u, additional_codes: u.additional_codes.filter(c => c !== codeToRemove) }
          : u
      ));

      toast({
        title: 'Sucesso',
        description: `Código ${codeToRemove} removido.`,
      });
    } catch (error) {
      console.error('Error removing doctor code:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao remover o código.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Gestão de Utilizadores</CardTitle>
                    <CardDescription>
                      Gerir permissões, roles e códigos de médico dos utilizadores
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadUsers}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                  <span className="ml-2 text-slate-500">A carregar utilizadores...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Nenhum utilizador encontrado.</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Os utilizadores aparecerão aqui após fazerem login.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Nome</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Código Médico</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Data de Registo</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const isCurrentUser = user.id === currentUserId;
                        const isUpdating = updatingUserId === user.id;
                        const isEditing = editingDoctorCode === user.id;
                        
                        return (
                          <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-25">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  {user.avatar_url ? (
                                    <img 
                                      src={user.avatar_url} 
                                      alt="" 
                                      className="h-8 w-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-medium text-slate-500">
                                      {(user.full_name || '?')[0].toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <span className="font-medium text-slate-900">
                                    {user.full_name || 'Sem nome'}
                                  </span>
                                  {isCurrentUser && (
                                    <span className="ml-2 text-xs text-slate-400">(você)</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-slate-600">{user.email || '-'}</span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col gap-2">
                                {/* Primary doctor code */}
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="text"
                                      value={doctorCodeInput}
                                      onChange={(e) => setDoctorCodeInput(e.target.value)}
                                      placeholder="Código principal"
                                      className="w-24 h-8 text-sm"
                                      autoFocus
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => updateDoctorCode(user.id)}
                                      disabled={isUpdating}
                                      className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    >
                                      {isUpdating ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Check className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={cancelEditingDoctorCode}
                                      disabled={isUpdating}
                                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1">
                                    {/* Primary code */}
                                    {user.doctor_code && (
                                      <div className="flex items-center gap-1">
                                        <Badge variant="secondary" className="bg-cyan-50 text-cyan-700 border border-cyan-200">
                                          {user.doctor_code}
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => startEditingDoctorCode(user)}
                                          className="h-5 w-5 p-0 text-slate-400 hover:text-slate-600"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                    {/* Additional codes */}
                                    {user.additional_codes.map((code) => (
                                      <div key={code} className="flex items-center gap-0.5">
                                        <Badge variant="secondary" className="bg-violet-50 text-violet-700 border border-violet-200">
                                          {code}
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeDoctorCode(user.id, code)}
                                          disabled={isUpdating}
                                          className="h-5 w-5 p-0 text-slate-400 hover:text-rose-500"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    {/* Add button or no codes message */}
                                    {!user.doctor_code && user.additional_codes.length === 0 && (
                                      <span className="text-slate-400 text-sm">Não definido</span>
                                    )}
                                    {!user.doctor_code && user.additional_codes.length === 0 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => startEditingDoctorCode(user)}
                                        className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                                
                                {/* Add new code row */}
                                {addingCodeUserId === user.id ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="text"
                                      value={newCodeInput}
                                      onChange={(e) => setNewCodeInput(e.target.value)}
                                      placeholder="Novo código"
                                      className="w-24 h-7 text-sm"
                                      autoFocus
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => addDoctorCode(user.id)}
                                      disabled={isUpdating || !newCodeInput.trim()}
                                      className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    >
                                      {isUpdating ? (
                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Check className="h-3 w-3" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => { setAddingCodeUserId(null); setNewCodeInput(''); }}
                                      disabled={isUpdating}
                                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setAddingCodeUserId(user.id)}
                                    className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 gap-1 justify-start"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Adicionar código
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <Badge 
                                variant={user.role === 'admin' ? 'default' : 'secondary'}
                                className={
                                  user.role === 'admin' 
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100' 
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                                }
                              >
                                {user.role === 'admin' ? (
                                  <>
                                    <Shield className="h-3 w-3 mr-1" />
                                    Admin
                                  </>
                                ) : (
                                  'Utilizador'
                                )}
                              </Badge>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-slate-600">{formatDate(user.created_at)}</span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {isCurrentUser ? (
                                <span className="text-sm text-slate-400 italic">
                                  Não pode alterar o próprio role
                                </span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleRole(user.id, user.role)}
                                  disabled={isUpdating}
                                  className={
                                    user.role === 'admin'
                                      ? 'text-slate-600 hover:text-slate-900 gap-1'
                                      : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1'
                                  }
                                >
                                  {isUpdating ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : user.role === 'admin' ? (
                                    <>
                                      <ShieldOff className="h-4 w-4" />
                                      Remover Admin
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="h-4 w-4" />
                                      Tornar Admin
                                    </>
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
