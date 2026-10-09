import React, { useState } from 'react';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roomName?: string;
}

export const SALA_1_PASSWORD = 'lanhouse';

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  roomName = 'Sala 1',
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (password.trim() === SALA_1_PASSWORD) {
      setError(false);
      setPassword('');
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-[#141916] border border-[#274237] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden relative flex flex-col p-6 text-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Ícone de Cadeado */}
        <div className="w-14 h-14 rounded-2xl bg-[#10b981]/15 border border-[#4edea3]/40 flex items-center justify-center text-[#4edea3] mx-auto mb-3 shadow-[0_0_25px_rgba(78,222,163,0.25)]">
          <span className="material-symbols-outlined text-[30px]">lock</span>
        </div>

        <span className="px-3 py-1 rounded-full bg-[#10b981]/10 text-[#4edea3] font-mono text-[10px] font-bold tracking-wider mb-2 border border-[#4edea3]/30 mx-auto">
          SALA RESTRITA
        </span>

        <h3 className="text-lg font-bold text-[#dfe4e0] mb-1">
          {roomName} Protegida por Senha
        </h3>

        <p className="text-xs text-[#bbcabf] mb-4">
          Digite a senha da LAN House para liberar seu acesso a esta sala:
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Digite a senha (lanhouse)"
              autoFocus
              className={`w-full bg-[#0a0f0d] border rounded-xl px-4 py-3 text-xs text-[#dfe4e0] outline-none pr-10 font-mono transition-colors ${
                error
                  ? 'border-[#ffb4ab] focus:border-[#ffb4ab] ring-1 ring-[#ffb4ab]'
                  : 'border-[#274237] focus:border-[#4edea3]'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86948a] hover:text-[#dfe4e0] cursor-pointer"
              title={showPassword ? 'Ocultar senha' : 'Ver senha'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>

          {error && (
            <div className="text-[11px] text-[#ffb4ab] font-semibold flex items-center justify-center gap-1 animate-in fade-in">
              <span className="material-symbols-outlined text-[14px]">error</span>
              <span>Senha incorreta! Digite a senha: <strong>lanhouse</strong></span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setPassword('');
                setError(false);
                onClose();
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#1c211e] hover:bg-[#262b29] text-[#bbcabf] hover:text-[#dfe4e0] text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#4edea3] hover:bg-[#00e296] text-[#003824] text-xs font-bold transition-all shadow-[0_0_20px_rgba(78,222,163,0.35)] cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              <span>Entrar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
