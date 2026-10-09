import React, { useState, useEffect } from 'react';
import { LAN_ROOMS } from '../constants/lanRooms';
import { SALA_1_PASSWORD } from './PasswordModal';

interface DisconnectModalProps {
  isOpen: boolean;
  onReconnect: (selectedChannelId: string) => void;
  onExit: () => void;
  currentChannel: string;
}

export const DisconnectModal: React.FC<DisconnectModalProps> = ({
  isOpen,
  onReconnect,
  onExit,
  currentChannel,
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState(currentChannel || '#lan-house-transmissao-sala-1');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedChannelId(currentChannel || '#lan-house-transmissao-sala-1');
      setPassword('');
      setPasswordError(false);
    }
  }, [isOpen, currentChannel]);

  if (!isOpen) return null;

  const isSala1 = selectedChannelId === '#lan-house-transmissao-sala-1';
  const currentRoomObj = LAN_ROOMS.find(r => r.id === selectedChannelId) || LAN_ROOMS[0];

  const handleConfirmReconnect = () => {
    if (isSala1 && password.trim() !== SALA_1_PASSWORD) {
      setPasswordError(true);
      return;
    }
    setPasswordError(false);
    onReconnect(selectedChannelId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0f0d]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#141916] border border-[#274237] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden relative flex flex-col items-center p-6 sm:p-7 text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#ffb4ab]/15 border border-[#ffb4ab]/40 flex items-center justify-center text-[#ffb4ab] mb-3 shadow-[0_0_25px_rgba(255,180,171,0.2)]">
          <span className="material-symbols-outlined text-[32px]">call_end</span>
        </div>

        <span className="px-3 py-1 rounded-full bg-[#ffb4ab]/10 text-[#ffb4ab] font-mono text-[10px] font-bold tracking-wider mb-2 border border-[#ffb4ab]/30">
          SESSÃO FINALIZADA
        </span>

        <h2 className="text-xl sm:text-2xl font-bold text-[#dfe4e0] tracking-tight mb-1">
          Você saiu da transmissão
        </h2>

        <p className="text-xs text-[#bbcabf] mb-5 leading-relaxed">
          Escolha uma das <strong>10 Salas da LAN House</strong> para se reconectar:
        </p>

        {/* Seletor das 10 Salas */}
        <div className="w-full flex flex-col gap-1.5 mb-4 text-left">
          <label className="text-xs font-semibold text-[#dfe4e0] flex items-center justify-between">
            <span>Selecione a Sala para Reconectar:</span>
            <span className="text-[10px] text-[#4edea3] font-mono">10 Salas Disponíveis</span>
          </label>
          <div className="relative">
            <select
              value={selectedChannelId}
              onChange={e => {
                setSelectedChannelId(e.target.value);
                setPasswordError(false);
              }}
              className="w-full appearance-none bg-[#0a0f0d] border border-[#274237] focus:border-[#4edea3] rounded-xl px-4 py-3 text-xs text-[#dfe4e0] font-bold outline-none cursor-pointer pr-10 transition-colors shadow-inner"
            >
              {LAN_ROOMS.map(room => (
                <option key={room.id} value={room.id} className="bg-[#181d1a] text-[#dfe4e0]">
                  {room.fullName} {room.isProtected ? '🔒 (Senha Obrigatória)' : ''}
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#4edea3] flex items-center">
              <span className="material-symbols-outlined text-[22px]">expand_more</span>
            </div>
          </div>
        </div>

        {/* Input de Senha se Sala 1 for escolhida */}
        {isSala1 && (
          <div className="w-full flex flex-col gap-1.5 mb-5 text-left animate-in fade-in duration-150">
            <label className="text-xs font-semibold text-[#dfe4e0] flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[#4edea3]">
                <span className="material-symbols-outlined text-[15px]">lock</span>
                <span>Senha da Sala 1:</span>
              </span>
              <span className="text-[10px] text-[#ffb4ab] font-mono">Requerida (lanhouse)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(false);
              }}
              placeholder="Digite a senha (lanhouse)"
              className={`w-full bg-[#0a0f0d] border rounded-xl px-4 py-2.5 text-xs text-[#dfe4e0] outline-none font-mono transition-colors ${
                passwordError
                  ? 'border-[#ffb4ab] focus:border-[#ffb4ab] ring-1 ring-[#ffb4ab]'
                  : 'border-[#274237] focus:border-[#4edea3]'
              }`}
            />
            {passwordError && (
              <span className="text-[11px] text-[#ffb4ab] font-semibold flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[14px]">error</span>
                <span>Senha incorreta! Digite: <strong>lanhouse</strong></span>
              </span>
            )}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="w-full flex flex-col sm:flex-row items-center gap-3 mt-1">
          <button
            type="button"
            onClick={handleConfirmReconnect}
            className="w-full py-3 px-4 rounded-xl bg-[#4edea3] hover:bg-[#00e296] text-[#003824] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(78,222,163,0.35)] cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">replay</span>
            <span>Reconectar na {currentRoomObj.shortName}</span>
          </button>

          <button
            type="button"
            onClick={onExit}
            className="w-full py-3 px-4 rounded-xl bg-[#1c211e] hover:bg-[#262b29] text-[#ffb4ab] hover:text-[#ff8a7a] border border-[#ffb4ab]/30 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Fechar / Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
};
