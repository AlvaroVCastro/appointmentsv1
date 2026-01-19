"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { appConfig } from '@/config/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setError(null);
      
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile openid',
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        console.error('OAuth error:', error);
        setError('Falha ao iniciar sessão. Por favor, tente novamente.');
        setIsSigningIn(false);
      }
      // Note: On success, browser redirects - no need to setIsSigningIn(false)
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
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                  Entrar com Microsoft
                </div>
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
