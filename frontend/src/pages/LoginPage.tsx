import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Mail, Lock, ShieldAlert, Sparkles } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

// Strict Form Schemas
const loginSchema = zod.object({
  username: zod.string().min(3, "Username must be at least 3 characters"),
  password: zod.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = zod.object({
  username: zod.string().min(3, "Username must be at least 3 characters"),
  email: zod.string().email("Invalid email address"),
  password: zod.string().min(6, "Password must be at least 6 characters"),
});

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const loginStore = useAuthStore((state) => state.login);
  
  // Login Form Hook
  const { 
    register: loginRegister, 
    handleSubmit: handleLoginSubmit, 
    formState: { errors: loginErrors } 
  } = useForm({
    resolver: zodResolver(loginSchema)
  });
  
  // Register Form Hook
  const { 
    register: regRegister, 
    handleSubmit: handleRegSubmit, 
    formState: { errors: regErrors } 
  } = useForm({
    resolver: zodResolver(registerSchema)
  });

  const onLogin = async (data: any) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await authApi.login(data.username, data.password);
      loginStore(res.access_token, res.role, res.username);
    } catch (err: any) {
      setApiError(err.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onRegister = async (data: any) => {
    setIsLoading(true);
    setApiError(null);
    try {
      await authApi.register(data.username, data.email, data.password);
      // Auto login after successful signup
      const res = await authApi.login(data.username, data.password);
      loginStore(res.access_token, res.role, res.username);
    } catch (err: any) {
      setApiError(err.response?.data?.detail || "Registration failed. Username or email might be taken.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-slate-100 dark:bg-[#080b11] transition-colors duration-300">
      {/* Background aesthetic decorative gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 glass-card rounded-2xl relative overflow-hidden"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 mb-3 bg-brand-500 rounded-xl shadow-glow-indigo text-white">
            <Sparkles className="w-6 h-6 animate-pulse-subtle" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Enterprise RAG Assistant
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Grounded vector search chat experience
          </p>
        </div>

        <AnimatePresence mode="wait">
          {apiError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center p-3 mb-4 text-sm text-red-600 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20 dark:border-red-950/40 dark:text-red-400"
            >
              <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{apiError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!isRegister ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleLoginSubmit(onLogin)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Username or Email
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-slate-400 left-3 top-3.5" />
                  <input
                    {...loginRegister('username')}
                    type="text"
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
                {loginErrors.username && (
                  <p className="text-xs text-red-500 mt-1">{loginErrors.username.message as string}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute w-4 h-4 text-slate-400 left-3 top-3.5" />
                  <input
                    {...loginRegister('password')}
                    type="password"
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
                {loginErrors.password && (
                  <p className="text-xs text-red-500 mt-1">{loginErrors.password.message as string}</p>
                )}
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="flex items-center justify-center w-full py-3 mt-6 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-glow-indigo transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setApiError(null); }}
                  className="text-xs text-brand-500 hover:underline"
                >
                  Need an account? Create one here
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleRegSubmit(onRegister)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Username
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-slate-400 left-3 top-3.5" />
                  <input
                    {...regRegister('username')}
                    type="text"
                    placeholder="johndoe"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
                {regErrors.username && (
                  <p className="text-xs text-red-500 mt-1">{regErrors.username.message as string}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-slate-400 left-3 top-3.5" />
                  <input
                    {...regRegister('email')}
                    type="email"
                    placeholder="john@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
                {regErrors.email && (
                  <p className="text-xs text-red-500 mt-1">{regErrors.email.message as string}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute w-4 h-4 text-slate-400 left-3 top-3.5" />
                  <input
                    {...regRegister('password')}
                    type="password"
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
                {regErrors.password && (
                  <p className="text-xs text-red-500 mt-1">{regErrors.password.message as string}</p>
                )}
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="flex items-center justify-center w-full py-3 mt-6 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-glow-indigo transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating account...
                  </span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                  </>
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setApiError(null); }}
                  className="text-xs text-brand-500 hover:underline"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
