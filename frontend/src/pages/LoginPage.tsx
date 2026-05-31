import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Mail, Lock, ShieldAlert } from 'lucide-react';
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
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-bg-subtle relative overflow-hidden font-sans select-none">
      {/* Geometric background pattern overlay */}
      <div 
        className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--border-strong) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-strong) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none bg-[radial-gradient(circle,var(--accent-dim)_0%,transparent_65%)] -top-[100px] left-1/2 -translate-x-1/2" />
      
      {/* Top Logo Panel */}
      <div className="flex items-center gap-2.5 mb-8 z-10 select-none">
        <div className="w-8 h-8 rounded-lg bg-text flex items-center justify-center text-bg">
          <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 stroke-bg fill-none stroke-[2.2]"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <span className="text-base font-extrabold tracking-tight text-text">RAG Assistant</span>
        <span className="text-[10px] font-semibold text-accent bg-accent-dim px-2 py-0.5 rounded-full border border-accent-mid select-none uppercase tracking-wider">Secure</span>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-7 bg-surface border border-border-mid shadow-lg rounded-2xl relative overflow-hidden z-10"
      >
        <div className="mb-6">
          <h1 className="text-lg font-bold tracking-tight text-text">
            {!isRegister ? "Sign in to RAG System" : "Create Enterprise Account"}
          </h1>
          <p className="text-xs text-text-3 mt-0.5">
            {!isRegister ? "Your secure knowledge base intelligence pipeline" : "Initialize your secure grounded search workspace"}
          </p>
        </div>

        {/* Social Authentication Placeholders */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button 
            type="button" 
            onClick={() => alert("Enterprise Google Sign-In is managed by corporate SSO. Please use your credentials below.")}
            className="flex items-center justify-center gap-2 h-9 border border-border-mid bg-surface hover:bg-bg-hover hover:border-border-strong text-text-2 text-xs font-semibold rounded-lg transition-all duration-150 active:scale-98"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-2"><path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/></svg>
            Google
          </button>
          <button 
            type="button"
            onClick={() => alert("GitHub OAuth is managed by workspace managers. Please login with credentials.")}
            className="flex items-center justify-center gap-2 h-9 border border-border-mid bg-surface hover:bg-bg-hover hover:border-border-strong text-text-2 text-xs font-semibold rounded-lg transition-all duration-150 active:scale-98"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </button>
        </div>

        <div className="flex items-center gap-2.5 my-4">
          <div className="flex-1 h-px bg-border-mid" />
          <span className="text-[10px] text-text-4 font-bold uppercase tracking-wider">or credentials</span>
          <div className="flex-1 h-px bg-border-mid" />
        </div>

        <AnimatePresence mode="wait">
          {apiError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center p-3 mb-4 text-xs font-semibold text-red border border-red-dim rounded-lg bg-red-dim text-red"
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
                <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
                  <input
                    {...loginRegister('username')}
                    type="text"
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 h-9 rounded-lg border border-border-mid bg-surface focus:border-accent focus:ring-2 focus:ring-accent-dim outline-none text-xs text-text transition-all placeholder:text-text-4"
                  />
                </div>
                {loginErrors.username && (
                  <p className="text-[10px] text-red mt-1 font-semibold">{loginErrors.username.message as string}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
                  <input
                    {...loginRegister('password')}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 h-9 rounded-lg border border-border-mid bg-surface focus:border-accent focus:ring-2 focus:ring-accent-dim outline-none text-xs text-text transition-all placeholder:text-text-4"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-text-4 hover:text-text-2 flex items-center justify-center"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                {loginErrors.password && (
                  <p className="text-[10px] text-red mt-1 font-semibold">{loginErrors.password.message as string}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs my-3">
                <label className="flex items-center gap-1.5 text-text-3 font-medium cursor-pointer">
                  <input type="checkbox" className="accent-accent w-3.5 h-3.5" defaultChecked /> 
                  Stay signed in
                </label>
                <a onClick={() => alert("Please ask a workspace administrator to recover your password details.")} className="text-accent hover:underline cursor-pointer font-medium">Forgot password?</a>
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="flex items-center justify-center w-full h-9 mt-4 text-xs font-bold text-text-inv bg-text hover:bg-black/90 active:scale-98 rounded-lg shadow-sm transition-all duration-150 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="w-3.5 h-3.5 border-2 border-text-inv border-t-transparent rounded-full animate-spin mr-2" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5 mr-2" />
                    Sign In
                  </>
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setApiError(null); }}
                  className="text-xs text-accent hover:underline font-semibold"
                >
                  Don't have an account? Request access
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
                <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
                  <input
                    {...regRegister('username')}
                    type="text"
                    placeholder="karingu"
                    className="w-full pl-9 pr-3 h-9 rounded-lg border border-border-mid bg-surface focus:border-accent focus:ring-2 focus:ring-accent-dim outline-none text-xs text-text transition-all placeholder:text-text-4"
                  />
                </div>
                {regErrors.username && (
                  <p className="text-[10px] text-red mt-1 font-semibold">{regErrors.username.message as string}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
                  <input
                    {...regRegister('email')}
                    type="email"
                    placeholder="karingu1@gmail.com"
                    className="w-full pl-9 pr-3 h-9 rounded-lg border border-border-mid bg-surface focus:border-accent focus:ring-2 focus:ring-accent-dim outline-none text-xs text-text transition-all placeholder:text-text-4"
                  />
                </div>
                {regErrors.email && (
                  <p className="text-[10px] text-red mt-1 font-semibold">{regErrors.email.message as string}</p>
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
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 h-9 rounded-lg border border-border-mid bg-surface focus:border-accent focus:ring-2 focus:ring-accent-dim outline-none text-xs text-text transition-all placeholder:text-text-4"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-text-4 hover:text-text-2 flex items-center justify-center"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                {regErrors.password && (
                  <p className="text-[10px] text-red mt-1 font-semibold">{regErrors.password.message as string}</p>
                )}
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="flex items-center justify-center w-full h-9 mt-6 text-xs font-bold text-text-inv bg-text hover:bg-black/90 active:scale-98 rounded-lg shadow-sm transition-all duration-150 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="w-3.5 h-3.5 border-2 border-text-inv border-t-transparent rounded-full animate-spin mr-2" />
                    Creating account...
                  </span>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5 mr-2" />
                    Create Account
                  </>
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setApiError(null); }}
                  className="text-xs text-accent hover:underline font-semibold"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer Security Badges */}
      <div className="flex items-center justify-center gap-4 mt-6 z-10 text-[10px] text-text-4 font-bold uppercase tracking-wider select-none">
        <div className="flex items-center gap-1.5"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-text-4 fill-none stroke-[2.2]"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> SOC 2 Type II</div>
        <div className="flex items-center gap-1.5"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-text-4 fill-none stroke-[2.2]"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Encrypted</div>
        <div className="flex items-center gap-1.5"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-text-4 fill-none stroke-[2.2]"><polyline points="20 6 9 17 4 12"/></svg> GDPR Ready</div>
      </div>
    </div>
  );
}

