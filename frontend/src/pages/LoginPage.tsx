import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Mail, Lock, ShieldAlert, Sparkles, Shield, Eye, EyeOff } from 'lucide-react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 3D perspective coordinate grid animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const speed = 0.6;
    let offset = 0;

    const drawGrid = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      // Deep brinjal aubergine dark gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#090311');
      grad.addColorStop(0.5, '#0E0616');
      grad.addColorStop(1, '#130c1c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(192, 132, 252, 0.07)'; // Soft purple grid lines
      ctx.lineWidth = 1;

      // Animate line offset for drifting effect
      offset = (offset + speed) % 40;

      // Perspective vanishing points
      const vpX = width / 2;
      const vpY = height * 0.15;

      // Draw horizontal lines in perspective spacing
      for (let y = height * 0.2; y < height; y += 35) {
        const ratio = (y - vpY) / (height - vpY);
        const currentY = vpY + ratio * ratio * (height - vpY) + offset * ratio;
        
        if (currentY > height) continue;
        
        ctx.beginPath();
        ctx.moveTo(0, currentY);
        ctx.lineTo(width, currentY);
        ctx.stroke();
      }

      // Draw vertical lines radiating from vanishing point
      const lines = 28;
      for (let i = 0; i <= lines; i++) {
        const targetX = (width / lines) * i;
        ctx.beginPath();
        ctx.moveTo(vpX, vpY);
        ctx.lineTo(targetX, height);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(drawGrid);
    };

    drawGrid();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
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
    <div className="relative flex items-center justify-center min-h-screen w-screen overflow-hidden font-sans select-none">
      
      {/* 3D Drifting perspective canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none" />

      {/* Grid overlay blobs */}
      <div className="absolute w-[900px] h-[900px] rounded-full pointer-events-none bg-[radial-gradient(circle,var(--accent-glow)_0%,transparent_65%)] -top-[300px] left-1/2 -translate-x-1/2 opacity-50 z-0" />
      
      {/* Main dual-pane viewport grid */}
      <div className="relative flex w-full max-w-6xl h-full min-h-[580px] lg:h-[680px] bg-[#0E0616]/70 border border-[#241334]/50 rounded-3xl overflow-hidden shadow-2xl z-10 m-4 backdrop-blur-md">
        
        {/* ── PANEL LEFT: Premium Marketing/Branding ── */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 p-14 z-10 text-left h-full border-r border-[#241334]/50 relative select-none">
          
          {/* Logo segment */}
          <div className="flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-xl bg-[#c084fc] text-[#0a0311] flex items-center justify-center shadow-md shadow-[#c084fc]/25">
              <Sparkles className="w-4.5 h-4.5 stroke-current" />
            </div>
            <span className="text-lg font-black tracking-tight text-white uppercase font-sans">trueailab</span>
          </div>

          {/* Core Info & 3 Cs */}
          <div className="space-y-8 my-auto pr-6">
            <div>
              <h1 className="text-3.5xl font-black tracking-tight text-white leading-tight">
                TRUEAILAB is an <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">Enterprise Assurance Platform</span>
              </h1>
              <p className="text-xs text-text-3 mt-4 leading-relaxed max-w-md font-medium">
                TRUEAILAB assures enterprise change by continuously validating Correctness, Completeness, and Compliance across applications, processes, data, and automation.
              </p>
            </div>

            <div className="space-y-3.5">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-pink-400">
                TRUEAILAB assures the 3 Cs of Enterprise Change
              </h3>
              
              {/* Correctness */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#140a1f]/60 border border-purple-950/25 shadow-md backdrop-blur-sm hover:border-[#c084fc]/20 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-purple-950/50 border border-purple-500/20 flex items-center justify-center text-pink-400 shrink-0 shadow-inner">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                    Correctness
                  </h4>
                  <p className="text-[11px] text-text-3 mt-1">Things behave as intended</p>
                </div>
              </div>

              {/* Completeness */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#140a1f]/60 border border-purple-950/25 shadow-md backdrop-blur-sm hover:border-[#c084fc]/20 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-purple-950/50 border border-purple-500/20 flex items-center justify-center text-pink-400 shrink-0 shadow-inner">
                  <svg className="w-5 h-5 stroke-current" fill="none" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                    Completeness
                  </h4>
                  <p className="text-[11px] text-text-3 mt-1">End-to-end workflows execute without gaps</p>
                </div>
              </div>

              {/* Compliance */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#140a1f]/60 border border-purple-950/25 shadow-md backdrop-blur-sm hover:border-[#c084fc]/20 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-purple-950/50 border border-purple-500/20 flex items-center justify-center text-pink-400 shrink-0 shadow-inner">
                  <svg className="w-5 h-5 stroke-current" fill="none" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                    Compliance
                  </h4>
                  <p className="text-[11px] text-text-3 mt-1">Regulatory, policy, and data obligations are continuously met</p>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright footer */}
          <div className="text-[10px] text-text-4 font-bold uppercase tracking-wider">
            © 2026 Copyright – TRUEAILAB
          </div>
        </div>
        
        {/* ── PANEL RIGHT: Interactive Sign-In Form ── */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-14 z-10 h-full relative select-none">
          
          {/* Mobile visible logo header */}
          <div className="flex lg:hidden items-center gap-2.5 absolute top-8 left-8 select-none">
            <div className="w-8 h-8 rounded-xl bg-[#c084fc] text-[#0a0311] flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 stroke-current" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-white uppercase">trueailab</span>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-[390px] p-8 lg:p-10 bg-[#0d0714]/85 border border-purple-950/40 shadow-xl rounded-2xl relative overflow-hidden backdrop-blur-md"
          >
            <div className="mb-8 text-center select-none">
              <h2 className="text-2xl font-black tracking-tight text-white">Sign In</h2>
              <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mt-1.5">Unified RAG Platform</p>
            </div>

            <AnimatePresence mode="wait">
              {apiError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start p-3 mb-5 text-xs font-semibold text-error border border-error/20 rounded-xl bg-error-dim"
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
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-[10px] font-black text-text-3 uppercase tracking-widest mb-1.5">
                      Email Id / Username *
                    </label>
                    <div className="relative flex items-center border-b border-[#241334] focus-within:border-pink-500 transition-colors py-1.5">
                      <Mail className="w-4 h-4 text-pink-500 mr-3 shrink-0" />
                      <input
                        {...loginRegister('username')}
                        type="text"
                        placeholder="Enter your credentials..."
                        className="w-full bg-transparent outline-none text-xs text-white placeholder:text-[#52525b] font-medium"
                      />
                    </div>
                    {loginErrors.username && (
                      <p className="text-[10px] text-error mt-1.5 font-semibold">{loginErrors.username.message as string}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-black text-text-3 uppercase tracking-widest">
                        Password *
                      </label>
                      <a 
                        onClick={() => alert("Please consult your workspace administrator to recover security keys.")} 
                        className="text-[10px] text-pink-400 hover:text-pink-300 cursor-pointer font-bold transition-colors"
                      >
                        Forgot Key?
                      </a>
                    </div>
                    <div className="relative flex items-center border-b border-[#241334] focus-within:border-pink-500 transition-colors py-1.5">
                      <Lock className="w-4 h-4 text-pink-500 mr-3 shrink-0" />
                      <input
                        {...loginRegister('password')}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="w-full bg-transparent outline-none text-xs text-white placeholder:text-[#52525b]"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#71717a] hover:text-[#a1a1aa] outline-none ml-2 shrink-0"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                      className="accent-[#3b2d9a] w-3.5 h-3.5 border-purple-900 rounded cursor-pointer bg-transparent" 
                      defaultChecked 
                    /> 
                    <label htmlFor="stay-signed-in" className="text-[11px] text-text-3 font-semibold cursor-pointer">
                      Persistent session key
                    </label>
                  </div>

                  <button
                    disabled={isLoading}
                    type="submit"
                    className="flex items-center justify-center w-full h-10 mt-6 text-xs font-bold text-white bg-[#3b2d9a] hover:bg-[#4837bb] active:scale-98 rounded-lg shadow-lg shadow-[#3b2d9a]/25 transition-all duration-150 disabled:opacity-50 outline-none"
                  >
                    {isLoading ? (
                      <span className="flex items-center">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Connecting...
                      </span>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign In
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-[#241334]" />
                    <span className="text-[9px] text-[#71717a] font-bold uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-[#241334]" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => alert("Google Single Sign-On (SSO) is configured by your workspace administrator.")}
                      className="flex items-center justify-center gap-1.5 h-10 border border-purple-500/20 text-purple-300 hover:bg-purple-950/20 hover:border-purple-500/40 text-[10.5px] font-bold rounded-lg transition-all duration-150 active:scale-98 select-none"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-pink-500"><path d="M12.545 9.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C9.978 18.292 8.158 19 6 19c-3.866 0-7-3.134-7-7s3.134-7 7-7c1.942 0 3.7.784 4.973 2.057L8.71 9.32C7.994 8.604 7.042 8.166 6 8.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H6v-3.08h6.545z"/></svg>
                      Google Login
                    </button>
                    <button 
                      type="button"
                      onClick={() => alert("GitHub Enterprise integration is managed via administrative OAuth tokens.")}
                      className="flex items-center justify-center gap-1.5 h-10 border border-purple-500/20 text-purple-300 hover:bg-purple-950/20 hover:border-purple-500/40 text-[10.5px] font-bold rounded-lg transition-all duration-150 active:scale-98 select-none"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-pink-500"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                      GitHub Login
                    </button>
                  </div>

                  <div className="text-center mt-6">
                    <button
                      type="button"
                      onClick={() => { setIsRegister(true); setApiError(null); }}
                      className="text-xs text-pink-400 hover:text-pink-300 font-bold transition-colors outline-none"
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
                    <label className="block text-[10px] font-black text-text-3 uppercase tracking-widest mb-1.5">
                      Username *
                    </label>
                    <div className="relative flex items-center border-b border-[#241334] focus-within:border-pink-500 transition-colors py-1.5">
                      <Mail className="w-4 h-4 text-pink-500 mr-3 shrink-0" />
                      <input
                        {...regRegister('username')}
                        type="text"
                        placeholder="E.g. sandboxed_user"
                        className="w-full bg-transparent outline-none text-xs text-white placeholder:text-[#52525b] font-medium"
                      />
                    </div>
                    {regErrors.username && (
                      <p className="text-[10px] text-error mt-1.5 font-semibold">{regErrors.username.message as string}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-text-3 uppercase tracking-widest mb-1.5">
                      Corporate Email *
                    </label>
                    <div className="relative flex items-center border-b border-[#241334] focus-within:border-pink-500 transition-colors py-1.5">
                      <Mail className="w-4 h-4 text-pink-500 mr-3 shrink-0" />
                      <input
                        {...regRegister('email')}
                        type="email"
                        placeholder="user@enterprise.com"
                        className="w-full bg-transparent outline-none text-xs text-white placeholder:text-[#52525b] font-medium"
                      />
                    </div>
                    {regErrors.email && (
                      <p className="text-[10px] text-error mt-1.5 font-semibold">{regErrors.email.message as string}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-text-3 uppercase tracking-widest mb-1.5">
                      Password *
                    </label>
                    <div className="relative flex items-center border-b border-[#241334] focus-within:border-pink-500 transition-colors py-1.5">
                      <Lock className="w-4 h-4 text-pink-500 mr-3 shrink-0" />
                      <input
                        {...regRegister('password')}
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 6 characters..."
                        className="w-full bg-transparent outline-none text-xs text-white placeholder:text-[#52525b]"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#71717a] hover:text-[#a1a1aa] outline-none ml-2 shrink-0"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {regErrors.password && (
                      <p className="text-[10px] text-error mt-1.5 font-semibold">{regErrors.password.message as string}</p>
                    )}
                  </div>

                  <button
                    disabled={isLoading}
                    type="submit"
                    className="flex items-center justify-center w-full h-10 mt-6 text-xs font-bold text-white bg-[#3b2d9a] hover:bg-[#4837bb] active:scale-98 rounded-lg shadow-lg shadow-[#3b2d9a]/25 transition-all duration-150 disabled:opacity-50 outline-none"
                  >
                    {isLoading ? (
                      <span className="flex items-center">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
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
                      className="text-xs text-pink-400 hover:text-pink-300 font-bold transition-colors outline-none"
                    >
                      Already have an account? Sign in
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
          
          {/* Mobile compliance tags */}
          <div className="flex lg:hidden items-center justify-center gap-4 mt-6 text-[8.5px] text-text-4 font-bold uppercase tracking-wider">
            <span>SOC 2 Type II</span>
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500/40" />
            <span>End-to-End Encrypted</span>
          </div>

        </div>

      </div>

    </div>
  );
}
