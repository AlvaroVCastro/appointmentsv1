"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { appConfig } from '@/config/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setError(null);
      // TODO: Implement authentication
      console.log('Authentication - to be implemented');
      setError('Autenticação ainda não implementada');
      setIsSigningIn(false);
    } catch (err) {
      console.error('Sign in error:', err);
      setError('Falha ao iniciar sessão. Por favor, tente novamente.');
      setIsSigningIn(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center pb-8 pt-8">
          <div className="flex justify-center">
            <Image 
              src={appConfig.logos.main} 
              alt="Logo" 
              width={64} 
              height={64} 
              className="h-16 w-16 rounded-lg"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-800">
              Appointment App
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Malo Clinic
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 pb-8">
          <Button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white font-medium transition-colors"
            size="lg"
          >
            {isSigningIn ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                A entrar...
              </div>
            ) : (
              'Entrar'
            )}
          </Button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800 text-center">{error}</p>
            </div>
          )}

          <div className="text-center pt-4">
            <p className="text-xs text-slate-500">
              Acesso restrito a utilizadores autorizados
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

