import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Mail, Lock, ShieldAlert, Sparkles, Shield, Cpu, LockKeyhole } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  
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
      setApiError(err.response?.data?.detail || "Invalid credentials. Please verify your username and password.");
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
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-bg-subtle relative overflow-hidden font-sans select-none dot-grid">
      {/* Geometric accent glow panels */}
      <div className="absolute w-[800px] h-[800px] rounded-full pointer-events-none bg-[radial-gradient(circle,var(--accent-glow)_0%,transparent_65%)] -top-[250px] left-1/2 -translate-x-1/2 opacity-60" />
      
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-2 mb-8 z-10 text-center">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent text-text-inv flex items-center justify-center shadow-md shadow-accent-glow">
            <Sparkles className="w-5 h-5 stroke-current" />
          </div>
          <span className="text-xl font-bold tracking-tight text-text">TRUEAILAB <span className="font-light text-text-3">Assistant</span></span>
        </div>
        <p className="text-xs text-text-3 font-medium mt-1">Enterprise Grounded Search & Vector Intelligence</p>
      </div>

      {/* Main card panel */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[420px] p-8 bg-surface border border-border shadow-lg rounded-2xl relative overflow-hidden z-10"
      >
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold tracking-tight text-text">
            {!isRegister ? "Sign In to Workspace" : "Initialize Creator Account"}
          </h1>
          <p className="text-xs text-text-3 mt-1 leading-relaxed">
            {!isRegister 
              ? "Access secure vector stores and AI pipelines" 
              : "Set up a new sandboxed knowledge retrieval shell"}
          </p>
        </div>

        {/* Social Authentication */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <button 
            type="button" 
            onClick={() => alert("Enterprise Single Sign-On (SSO) authentication is managed by workspace administrators.")}
            className="flex items-center justify-center gap-2 h-9 border border-border bg-surface hover:bg-bg-hover hover:border-border-strong text-text-2 text-xs font-semibold rounded-lg transition-all duration-150 active:scale-98"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-2"><path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/></svg>
            Google SSO
          </button>
          <button 
            type="button"
            onClick={() => alert("GitHub Enterprise integration is managed via administrative OAuth tokens.")}
            className="flex items-center justify-center gap-2 h-9 border border-border bg-surface hover:bg-bg-hover hover:border-border-strong text-text-2 text-xs font-semibold rounded-lg transition-all duration-150 active:scale-98"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </button>
        </div>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-text-4 font-bold uppercase tracking-wider">or workspace account</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <AnimatePresence mode="wait">
          {apiError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start p-3 mb-4 text-xs font-medium text-error border border-error/20 rounded-xl bg-error-dim"
            >
              <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!isRegister ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              onSubmit={handleLoginSubmit(onLogin)}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
                  <input
                    {...loginRegister('username')}
                    type="text"
                    placeholder="Enter your username..."
                    className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-bg-subtle focus:border-accent focus:bg-surface focus:ring-1 focus:ring-accent outline-none text-xs text-text transition-all placeholder:text-text-4 font-medium"
                  />
                </div>
                {loginErrors.username && (
                  <p className="text-[10px] text-error mt-1.5 font-semibold">{loginErrors.username.message as string}</p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider">
                    Password
                  </label>
                  <a 
                    onClick={() => alert("Please consult your workspace administrator to recover security keys.")} 
                    className="text-[11px] text-accent hover:text-accent-hover cursor-pointer font-bold transition-colors"
                  >
                    Forgot Key?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
                  <input
                    {...loginRegister('password')}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 h-9 rounded-lg border border-border bg-bg-subtle focus:border-accent focus:bg-surface focus:ring-1 focus:ring-accent outline-none text-xs text-text transition-all placeholder:text-text-4"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-text-4 hover:text-text-2 flex items-center justify-center outline-none"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                {loginErrors.password && (
                  <p className="text-[10px] text-error mt-1.5 font-semibold">{loginErrors.password.message as string}</p>
                )}
              </div>

              <div className="flex items-center gap-2 py-1 select-none">
                <input 
                  type="checkbox" 
                  id="stay-signed-in"
                  className="accent-accent w-3.5 h-3.5 border-border rounded cursor-pointer" 
                  defaultChecked 
                /> 
                <label htmlFor="stay-signed-in" className="text-xs text-text-3 font-semibold cursor-pointer">
                  Persistent session key
                </label>
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="flex items-center justify-center w-full h-9.5 mt-5 text-xs font-bold text-text-inv bg-text hover:bg-text-2 active:scale-98 rounded-lg shadow-sm transition-all duration-150 disabled:opacity-50 outline-none"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="w-4 h-4 border-2 border-text-inv border-t-transparent rounded-full animate-spin mr-2" />
                    Connecting...
                  </span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Authenticate Workspace
                  </>
                )}
              </button>

              <div className="text-center mt-5">
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setApiError(null); }}
                  className="text-xs text-accent hover:text-accent-hover font-bold transition-colors outline-none"
                >
                  Create new workspace account
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              onSubmit={handleRegSubmit(onRegister)}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
                  <input
                    {...regRegister('username')}
                    type="text"
                    placeholder="E.g. sandboxed_user"
                    className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-bg-subtle focus:border-accent focus:bg-surface focus:ring-1 focus:ring-accent outline-none text-xs text-text transition-all placeholder:text-text-4 font-medium"
                  />
                </div>
                {regErrors.username && (
                  <p className="text-[10px] text-error mt-1.5 font-semibold">{regErrors.username.message as string}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
                  <input
                    {...regRegister('email')}
                    type="email"
                    placeholder="user@enterprise.com"
                    className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-bg-subtle focus:border-accent focus:bg-surface focus:ring-1 focus:ring-accent outline-none text-xs text-text transition-all placeholder:text-text-4 font-medium"
                  />
                </div>
                {regErrors.email && (
                  <p className="text-[10px] text-error mt-1.5 font-semibold">{regErrors.email.message as string}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
                  <input
                    {...regRegister('password')}
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters..."
                    className="w-full pl-9 pr-9 h-9 rounded-lg border border-border bg-bg-subtle focus:border-accent focus:bg-surface focus:ring-1 focus:ring-accent outline-none text-xs text-text transition-all placeholder:text-text-4"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-text-4 hover:text-text-2 flex items-center justify-center outline-none"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                {regErrors.password && (
                  <p className="text-[10px] text-error mt-1.5 font-semibold">{regErrors.password.message as string}</p>
                )}
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="flex items-center justify-center w-full h-9.5 mt-6 text-xs font-bold text-text-inv bg-text hover:bg-text-2 active:scale-98 rounded-lg shadow-sm transition-all duration-150 disabled:opacity-50 outline-none"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="w-4 h-4 border-2 border-text-inv border-t-transparent rounded-full animate-spin mr-2" />
                    Initializing Node...
                  </span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Initialize Workspace
                  </>
                )}
              </button>

              <div className="text-center mt-5">
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setApiError(null); }}
                  className="text-xs text-accent hover:text-accent-hover font-bold transition-colors outline-none"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Trust & Compliance Seals */}
      <div className="flex items-center justify-center gap-5 mt-8 z-10 text-[9.5px] text-text-4 font-bold uppercase tracking-wider select-none max-w-sm flex-wrap px-4">
        <div className="flex items-center gap-1.5 hover:text-text-3 transition-colors duration-150">
          <Shield className="w-3.5 h-3.5 stroke-current" /> 
          SOC 2 Type II
        </div>
        <div className="flex items-center gap-1.5 hover:text-text-3 transition-colors duration-150">
          <LockKeyhole className="w-3.5 h-3.5 stroke-current" />
          End-to-End Encryption
        </div>
        <div className="flex items-center gap-1.5 hover:text-text-3 transition-colors duration-150">
          <Cpu className="w-3.5 h-3.5 stroke-current" />
          GDPR Compliant
        </div>
      </div>
    </div>
  );
}
