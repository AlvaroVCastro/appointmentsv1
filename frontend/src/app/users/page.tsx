"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Utilizador';
  registrationDate: string;
  isCurrentUser?: boolean;
}

// Hardcoded users matching the screenshot exactly
const users: User[] = [
  {
    id: '1',
    name: 'Ana Luísa Macedo',
    email: 'amacedo@maloclinics.com',
    role: 'Utilizador',
    registrationDate: '05/12/2025',
  },
  {
    id: '2',
    name: 'Sónia Conceição',
    email: 'sconceicao@maloclinics.com',
    role: 'Utilizador',
    registrationDate: '05/12/2025',
  },
  {
    id: '3',
    name: 'Carla A. Pires',
    email: 'capires@maloclinics.com',
    role: 'Utilizador',
    registrationDate: '05/12/2025',
  },
  {
    id: '4',
    name: 'Augusta Labs',
    email: 'alabs@maloclinics.com',
    role: 'Admin',
    registrationDate: '05/11/2025',
    isCurrentUser: true,
  },
  {
    id: '5',
    name: 'Ana R. Silva',
    email: 'arsilva@maloclinics.com',
    role: 'Admin',
    registrationDate: '30/10/2025',
  },
  {
    id: '6',
    name: 'Joana Alegria',
    email: 'jalegria@maloclinics.com',
    role: 'Utilizador',
    registrationDate: '27/10/2025',
  },
  {
    id: '7',
    name: 'Sérgio Mestre',
    email: 'smestre@maloclinics.com',
    role: 'Admin',
    registrationDate: '22/10/2025',
  },
];

export default function UsersPage() {
  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Gestão de Utilizadores</CardTitle>
                  <CardDescription>
                    Gerir permissões e roles dos utilizadores da aplicação
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Nome</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Role</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Data de Registo</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-25">
                        <td className="py-4 px-4">
                          <span className="font-medium text-slate-900">{user.name}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-slate-600">{user.email}</span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge 
                            variant={user.role === 'Admin' ? 'default' : 'secondary'}
                            className={
                              user.role === 'Admin' 
                                ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100' 
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                            }
                          >
                            {user.role === 'Admin' && <span className="mr-1">○</span>}
                            {user.role}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-slate-600">{user.registrationDate}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {user.isCurrentUser ? (
                              <span className="text-sm text-slate-400 italic">
                                Você (não pode remover)
                              </span>
                            ) : user.role === 'Admin' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-600 hover:text-slate-900"
                              >
                                Remover Admin
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-600 hover:text-slate-900 gap-1"
                              >
                                <span className="text-slate-400">◐</span>
                                Tornar Admin
                              </Button>
                            )}
                            {!user.isCurrentUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              >
                                Revogar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

