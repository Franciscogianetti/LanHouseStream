import React from 'react';
import { Participant } from '../types/stream';

import { LanRoom, LAN_ROOMS } from '../constants/lanRooms';

interface SidebarProps {
  currentChannel: string;
  onSelectChannel: (channel: string) => void;
  participants: Participant[];
  isConnected: boolean;
  onDisconnectToggle: () => void;
  unlockedRooms: Set<string>;
  onRequestPasswordRoom: (roomId: string) => void;
  onToggleUserSpeaking?: (userId: string) => void;
  currentUserId?: string;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isDeafened?: boolean;
  onToggleDeafen?: () => void;
  isNoiseSuppression?: boolean;
  onToggleNoiseSuppression?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  currentChannel,
  onSelectChannel,
  participants,
  isConnected,
  onDisconnectToggle,
  unlockedRooms,
  onRequestPasswordRoom,
  onToggleUserSpeaking,
  currentUserId,
  isMuted = false,
  onToggleMute,
  isDeafened = false,
  onToggleDeafen,
  isNoiseSuppression = true,
  onToggleNoiseSuppression,
}) => {
  const handleRoomClick = (room: LanRoom) => {
    if (room.id === currentChannel) return;
    if (room.isProtected && !unlockedRooms.has(room.id)) {
      onRequestPasswordRoom(room.id);
    } else {
      onSelectChannel(room.id);
    }
  };

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#0a0f0d] z-30 hidden md:flex flex-col border-r border-[#1f332a] shadow-[1px_0_12px_rgba(0,0,0,0.3)]">
      {/* Voice Channels Section (Sala 1 a Sala 10) */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-[#86948a] uppercase tracking-wider">
            Salas da Lan House
          </span>
          <span className="text-[10px] text-[#4edea3] font-mono">10 Salas</span>
        </div>

        {/* Lista com scroll para as 10 salas */}
        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
          {LAN_ROOMS.map(room => {
            const isActive = currentChannel === room.id;
            const isProtected = room.isProtected;
            const isUnlocked = unlockedRooms.has(room.id);

            return (
              <button
                key={room.id}
                onClick={() => handleRoomClick(room)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left text-xs cursor-pointer ${
                  isActive
                    ? 'bg-[#1c211e] text-[#4edea3] font-semibold border border-[#274237]'
                    : 'text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#181d1a] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`material-symbols-outlined text-[16px] ${isActive ? 'text-[#4edea3]' : 'text-[#86948a]'}`}>
                    {isProtected ? (isUnlocked ? 'lock_open' : 'lock') : 'volume_up'}
                  </span>
                  <span className="truncate">{room.fullName}</span>
                </div>
                <div className="flex items-center gap-1">
                  {isProtected && !isUnlocked && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#ffb4ab]/15 text-[#ffb4ab] border border-[#ffb4ab]/30">
                      Senha
                    </span>
                  )}
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-[#4edea3] shadow-[0_0_8px_#10b981]"></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[#1f332a] mx-3"></div>

      {/* Active Roster List (Participantes de 10) */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-[#86948a] uppercase tracking-wider">
            Participantes ({participants.length} de 10)
          </span>
          <span className="material-symbols-outlined text-[16px] text-[#4edea3]" title="Monitor de Áudio WebRTC">
            graphic_eq
          </span>
        </div>

        {participants.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-[#86948a] italic bg-[#181d1a]/50 rounded-xl border border-[#1f332a]/40">
            Nenhum participante conectado na sala
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {participants.map(user => {
              const isMe = Boolean(currentUserId ? user.id === currentUserId : user.name.includes('(Você)'));
              const cleanName = user.name.replace(/\s*\(Você\)\s*/g, '').trim();
              const isUserMuted = isMe ? Boolean(isMuted) : Boolean(user.isMuted);
              const isSpeaking = user.isSpeaking && !isUserMuted;

              return (
                <div
                  key={user.id}
                  onClick={() => onToggleUserSpeaking && onToggleUserSpeaking(user.id)}
                  title={isSpeaking ? `${cleanName} está falando (Voz Ativa)` : `${cleanName} (Voz inativa)`}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-150 cursor-pointer ${
                    isSpeaking
                      ? 'bg-[#18261e] border-2 border-[#4edea3] shadow-[0_0_14px_rgba(78,222,163,0.55)] ring-1 ring-[#4edea3]/40'
                      : isMe
                      ? 'bg-[#1c221e] border border-[#274237]/80 hover:border-[#4edea3]/50'
                      : 'bg-[#181d1a] border border-[#1f332a]/60 hover:border-[#274237]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full transition-all ${
                        isSpeaking
                          ? 'bg-[#4edea3] ring-2 ring-[#4edea3]/60 shadow-[0_0_8px_#4edea3] animate-pulse'
                          : isUserMuted
                          ? 'bg-[#ffb4ab]'
                          : 'bg-[#00e296]'
                      }`}
                    ></span>
                    <span
                      className={`text-xs truncate transition-colors ${
                        isSpeaking
                          ? 'text-[#4edea3] font-bold'
                          : isUserMuted
                          ? 'text-[#86948a]'
                          : 'text-[#dfe4e0]'
                      }`}
                    >
                      {isMe ? `${cleanName} (Você)` : cleanName}
                    </span>
                  </div>

                  {/* Área de Controles: Exclusiva para o Usuário Atual (Outros usuários veem apenas indicador de status) */}
                  <div className="flex items-center gap-1">
                    {user.isScreenSharing && (
                      <span className="material-symbols-outlined text-[#4edea3] text-[14px]" title="Transmitindo Tela">
                        screen_share
                      </span>
                    )}

                    {isMe ? (
                      /* CONTROLES EXCLUSIVOS DO USUÁRIO ATUAL: Mudo, Supressão de Ruído e Mutar Chamada */
                      <div className="flex items-center gap-1">
                        {/* 1. Botão de Mute do Microfone */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleMute) onToggleMute();
                          }}
                          className={`p-1 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                            isMuted
                              ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40 hover:bg-[#ffb4ab]/30'
                              : 'bg-[#181d1a] text-[#4edea3] hover:bg-[#262b29] border border-[#1f332a]'
                          }`}
                          title={isMuted ? 'Desmutar Microfone (Ctrl+D)' : 'Silenciar Microfone (Ctrl+D)'}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {isMuted ? 'mic_off' : 'mic'}
                          </span>
                        </button>

                        {/* 2. Botão de Supressão de Ruído Inteligente */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleNoiseSuppression) onToggleNoiseSuppression();
                          }}
                          className={`p-1 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                            isNoiseSuppression
                              ? 'bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/40 shadow-[0_0_8px_rgba(78,222,163,0.3)] hover:bg-[#4edea3]/30'
                              : 'bg-[#181d1a] text-[#86948a] hover:text-[#dfe4e0] hover:bg-[#262b29] border border-[#1f332a]'
                          }`}
                          title={
                            isNoiseSuppression
                              ? 'Supressão de Ruído Ativada (Clique para desativar)'
                              : 'Supressão de Ruído Desativada (Clique para ativar)'
                          }
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {isNoiseSuppression ? 'graphic_eq' : 'sound_sampler'}
                          </span>
                        </button>

                        {/* 3. Botão de Mutar a Chamada (Ensurdecer) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleDeafen) onToggleDeafen();
                          }}
                          className={`p-1 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                            isDeafened
                              ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40 hover:bg-[#ffb4ab]/30'
                              : 'bg-[#181d1a] text-[#bbcabf] hover:text-[#4edea3] hover:bg-[#262b29] border border-[#1f332a]'
                          }`}
                          title={isDeafened ? 'Restaurar Áudio da Chamada' : 'Mutar Áudio da Chamada (Ensurdecer)'}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {isDeafened ? 'headset_off' : 'headset'}
                          </span>
                        </button>
                      </div>
                    ) : (
                      /* INDICADOR PASSIVO PARA OUTROS PARTICIPANTES (Sem botões interativos) */
                      <div className="flex items-center gap-1">
                        <span
                          className={`material-symbols-outlined text-[15px] ${
                            user.isMuted
                              ? 'text-[#ffb4ab]'
                              : isSpeaking
                              ? 'text-[#4edea3] animate-pulse'
                              : 'text-[#86948a]'
                          }`}
                          title={user.isMuted ? `${cleanName} está com microfone mutado` : `${cleanName} com microfone ativo`}
                        >
                          {user.isMuted ? 'mic_off' : 'mic'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Voice Status Block */}
      <div className="p-3 bg-[#181d1a] border-t border-[#1f332a] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-[#4edea3] shadow-[0_0_8px_#10b981]' : 'bg-[#ffb4ab]'
            }`}
          ></span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-[#dfe4e0] truncate">
              {isConnected ? 'Voz Conectada (WebRTC)' : 'Desconectado'}
            </span>
            <span className="text-[10px] text-[#86948a] font-mono">
              {isConnected ? 'Latência: 12ms • Estável' : 'Clique para reconectar'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onDisconnectToggle}
          className="p-1.5 rounded-lg bg-[#262b29] hover:bg-[#ffb4ab]/20 text-[#bbcabf] hover:text-[#ffb4ab] transition-colors cursor-pointer"
          title={isConnected ? "Desconectar da Sala" : "Reconectar à Sala"}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isConnected ? 'call_end' : 'replay'}
          </span>
        </button>
      </div>
    </aside>
  );
});
