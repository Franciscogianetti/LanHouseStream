import React, { useState, useEffect, useRef } from 'react';
import { Participant, StreamSource, ChatMessage, StreamPreset, ActiveStream } from '../types/stream';
import { STREAM_PRESETS, APP_ASSETS } from '../data/mockData';
import { StreamTile } from './StreamTile';
import { resolveAvatarUrl } from '../data/avatarOptions';
import { AvatarImage } from './AvatarImage';

interface StageViewProps {
  currentSource: StreamSource;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  onOpenSourceModal: () => void;
  participants: Participant[];
  currentPreset: StreamPreset;
  onSelectPreset: (preset: StreamPreset) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  isNoiseSuppression?: boolean;
  onToggleNoiseSuppression?: () => void;
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onDisconnect: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  activeStreams: ActiveStream[];
  onCloseStream: (id: string) => void;
  onAddTestStream?: () => void;
  onOpenWebcamModal: () => void;
  webcamStream: MediaStream | null;
  currentUserName?: string;
  currentUserId?: string;
  onSimulateJoin?: () => void;
  onSimulateLeave?: () => void;
}

export const StageView: React.FC<StageViewProps> = ({
  currentSource,
  isStreaming,
  onToggleStreaming,
  onOpenSourceModal,
  participants,
  currentPreset,
  onSelectPreset,
  chatMessages,
  onSendMessage,
  onToggleReaction,
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  isNoiseSuppression = true,
  onToggleNoiseSuppression,
  isCameraOn,
  onToggleCamera,
  onDisconnect,
  onShowToast,
  activeStreams,
  onCloseStream,
  onAddTestStream,
  onOpenWebcamModal,
  webcamStream,
  currentUserName,
  currentUserId,
  onSimulateJoin,
  onSimulateLeave,
}) => {
  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'roster'>('chat');
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const [ping, setPing] = useState(14);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [maximizedStreamId, setMaximizedStreamId] = useState<string | null>(null);

  // Controles de tamanho e expansão da webcam do usuário
  const [webcamSize, setWebcamSize] = useState<'normal' | 'large' | 'expanded'>('normal');
  const [isWebcamMirrored, setIsWebcamMirrored] = useState(true);

  const stageRef = useRef<HTMLDivElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);

  // Sincronizar stream de vídeo da webcam com liberação imediata de buffers no unmount
  useEffect(() => {
    const videoEl = webcamVideoRef.current;
    if (videoEl && webcamStream) {
      videoEl.srcObject = webcamStream;
      videoEl.play().catch(() => {});
    }

    return () => {
      if (videoEl) {
        try {
          videoEl.pause();
          videoEl.srcObject = null;
          videoEl.load();
        } catch {}
      }
    };
  }, [webcamStream, isCameraOn, webcamSize]);

  // Auto-scroll chat on new message
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      stageRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
      onShowToast('Modo tela cheia ativado', 'fullscreen');
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
      onShowToast('Tela cheia finalizada', 'fullscreen_exit');
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Close presets menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresetsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Submit chat message
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    onSendMessage(chatInputText.trim());
    setChatInputText('');
  };

  return (
    <div className="flex flex-col xl:flex-row w-full h-[calc(100vh-4rem)] p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden bg-[#0a0f0d]">
      {/* MAIN TRANSMISSION STAGE */}
      <section
        ref={stageRef}
        id="stage-main-container"
        className="relative flex-1 flex flex-col min-w-0 h-full rounded-2xl bg-[#181d1a] border border-[#1f332a] overflow-hidden shadow-2xl"
      >
        {/* Top HUD of Stream */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-[#0a0f0d]/90 via-[#0a0f0d]/40 to-transparent">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Live Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
                (isStreaming || activeStreams.length > 0)
                  ? 'bg-[#00ffaa]/15 border border-[#00ffaa]/40 shadow-[0_0_15px_rgba(0,255,170,0.25)]'
                  : 'bg-[#313633] border border-[#3c4a42]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  (isStreaming || activeStreams.length > 0) ? 'bg-[#00ffaa] animate-pulse' : 'bg-[#86948a]'
                }`}
              ></span>
              <span
                className={`font-mono text-[11px] font-bold tracking-wider ${
                  (isStreaming || activeStreams.length > 0) ? 'text-[#00ffaa]' : 'text-[#bbcabf]'
                }`}
              >
                {(isStreaming || activeStreams.length > 0) ? 'AO VIVO' : 'PAUSADO'}
              </span>
            </div>

            {/* Streamer & Source Information */}
            <div className="flex items-center gap-2 bg-[#1c211e]/85 backdrop-blur-md px-3 py-1 rounded-lg border border-[#1f332a]">
              <span className="material-symbols-outlined text-[#4edea3] text-[16px]">
                {currentSource.icon}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#dfe4e0]">
                {activeStreams[0]?.participantName || currentUserName || 'Lan House Stream'}
              </span>
              <span className="text-[11px] text-[#bbcabf] hidden sm:inline">
                compartilhando {activeStreams[0]?.title || currentSource.name}
              </span>
            </div>

            {/* Quality, System Audio & Bitrate */}
            <div className="hidden lg:flex items-center gap-2 bg-[#1c211e]/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#1f332a]/60 text-xs font-mono">
              <span className="text-[#4edea3]">{currentPreset.quality}</span>
              <span className="text-[#86948a]">•</span>
              <span className="text-[#00e296]">{currentPreset.bitrate}</span>
            </div>
          </div>

          {/* Right Top HUD Actions */}
          <div className="flex items-center gap-1.5">
            {/* Ping Chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c211e]/85 backdrop-blur-md border border-[#1f332a] text-xs font-mono text-[#4edea3]">
              <span className="material-symbols-outlined text-[14px]">wifi</span>
              <span>{ping}ms</span>
            </div>

            {/* Theater Mode Button */}
            <button
              onClick={() => {
                setIsTheaterMode(!isTheaterMode);
                onShowToast(
                  !isTheaterMode ? 'Modo Cinema ativado (Sidebar oculta)' : 'Modo padrão restaurado',
                  'aspect_ratio'
                );
              }}
              className={`p-1.5 rounded-lg border transition-all ${
                isTheaterMode
                  ? 'bg-[#262b29] text-[#4edea3] border-[#4edea3]/40'
                  : 'bg-[#1c211e]/80 text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#262b29] border-[#1f332a]'
              }`}
              title={isTheaterMode ? 'Restaurar Painel Lateral' : 'Modo Cinema (Expandir Tela)'}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">aspect_ratio</span>
            </button>
          </div>
        </div>

        {/* Central Multi-Screen Grid Viewport */}
        <div className="relative w-full flex-1 flex flex-col bg-[#0a0f0d] overflow-hidden select-none p-2 sm:p-3 pt-16 sm:pt-16 pb-20">
          {activeStreams.length === 0 ? (
            /* Palco Vazio - Apenas botão direto de compartilhamento */
            <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center select-none rounded-2xl bg-[#141916] border border-[#1f332a]">
              <div className="w-16 h-16 rounded-2xl bg-[#1c211e] border border-[#274237] flex items-center justify-center text-[#4edea3] mb-4 shadow-[0_0_30px_rgba(78,222,163,0.2)]">
                <span className="material-symbols-outlined text-[36px]">screen_share</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={onOpenSourceModal}
                  className="px-6 py-3 rounded-xl bg-[#4edea3] hover:bg-[#00e296] text-[#003824] font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(78,222,163,0.35)] transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">screen_share</span>
                  <span>Compartilhar Tela ou Janela</span>
                </button>
              </div>
            </div>
          ) : maximizedStreamId ? (
            /* Modo Maximizado: 1 tela cobrindo 100% da área do palco */
            (() => {
              const maxStream = activeStreams.find(s => s.id === maximizedStreamId) || activeStreams[0];
              return (
                <div className="relative w-full h-full flex flex-col">
                  <StreamTile
                    stream={maxStream}
                    isMaximized={true}
                    onToggleMaximize={() => setMaximizedStreamId(null)}
                    onClose={() => {
                      onCloseStream(maxStream.id);
                      setMaximizedStreamId(null);
                    }}
                    onShowToast={onShowToast}
                    currentUserId={currentUserId}
                  />
                </div>
              );
            })()
          ) : (
            /* Grade Dinâmica de Transmissões (1 tela cheia, 2 telas empilhadas verticalmente, 3 telas, 4 telas em 2x2, etc.) */
            <div
              className={`w-full h-full ${
                activeStreams.length === 1
                  ? 'flex flex-col'
                  : activeStreams.length === 2
                  ? 'grid grid-cols-1 grid-rows-2 gap-3 h-full overflow-y-auto'
                  : activeStreams.length === 3
                  ? 'grid grid-cols-1 md:grid-cols-3 gap-3 overflow-y-auto'
                  : activeStreams.length === 4
                  ? 'grid grid-cols-2 grid-rows-2 gap-3 overflow-y-auto'
                  : activeStreams.length <= 6
                  ? 'grid grid-cols-2 md:grid-cols-3 gap-2.5 overflow-y-auto'
                  : activeStreams.length <= 8
                  ? 'grid grid-cols-2 md:grid-cols-4 gap-2 overflow-y-auto'
                  : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 overflow-y-auto'
              }`}
            >
              {activeStreams.map(stream => (
                <StreamTile
                  key={stream.id}
                  stream={stream}
                  isMaximized={false}
                  onToggleMaximize={() => setMaximizedStreamId(stream.id)}
                  onClose={() => onCloseStream(stream.id)}
                  onShowToast={onShowToast}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}

          {/* Câmera do Host flutuante com opções de Expandir e Aumentar o Tamanho */}
          {isCameraOn && (
            <div
              className={`z-30 pointer-events-auto transition-all duration-300 ${
                webcamSize === 'expanded'
                  ? 'absolute inset-2 sm:inset-6 flex items-center justify-center bg-black/75 backdrop-blur-md rounded-2xl z-40'
                  : webcamSize === 'large'
                  ? 'absolute top-16 sm:top-18 right-3 sm:right-4 w-72 sm:w-96 aspect-video'
                  : 'absolute top-16 sm:top-18 right-3 sm:right-4 w-44 sm:w-56 aspect-video'
              }`}
            >
              <div
                className={`relative w-full h-full rounded-2xl overflow-hidden bg-black border border-[#4edea3]/50 shadow-[0_10px_40px_rgba(0,0,0,0.85)] text-left group flex flex-col justify-between ${
                  webcamSize === 'expanded'
                    ? 'max-w-4xl max-h-[82vh] border-[#4edea3] shadow-[0_0_60px_rgba(78,222,163,0.35)]'
                    : ''
                }`}
              >
                {/* Visualizador de Vídeo da Webcam */}
                {webcamStream ? (
                  <video
                    ref={webcamVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transition-transform ${
                      isWebcamMirrored ? '-scale-x-100' : ''
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#1c211e] text-[#4edea3] min-h-[120px]">
                    <span className="material-symbols-outlined text-[32px] animate-pulse">videocam</span>
                    <span className="text-xs font-mono text-[#bbcabf] mt-1.5">Webcam Ativa</span>
                  </div>
                )}

                {/* Barra Superior de Controles da Webcam: Expandir, Aumentar, Espelhar e Fechar */}
                <div className="absolute top-0 inset-x-0 p-2 sm:p-2.5 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between opacity-90 group-hover:opacity-100 transition-opacity z-20">
                  {/* Badge de Status */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#0a0f0d]/80 border border-[#1f332a] text-[10px] font-mono text-[#4edea3]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                    <span className="font-semibold">
                      {webcamSize === 'expanded'
                        ? 'Webcam (Expandida)'
                        : webcamSize === 'large'
                        ? 'Webcam (Grande)'
                        : 'Webcam'}
                    </span>
                  </div>

                  {/* Ações de Controle da Webcam */}
                  <div className="flex items-center gap-1 bg-[#0a0f0d]/80 backdrop-blur-md p-1 rounded-xl border border-[#1f332a]">
                    {/* Botão Aumentar / Diminuir */}
                    {webcamSize !== 'expanded' && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = webcamSize === 'normal' ? 'large' : 'normal';
                          setWebcamSize(next);
                          onShowToast(
                            next === 'large'
                              ? 'Webcam ampliada para tamanho grande'
                              : 'Webcam restaurada para tamanho padrão',
                            'aspect_ratio'
                          );
                        }}
                        className="w-6 h-6 rounded-lg bg-[#1c211e] hover:bg-[#262b29] text-[#bbcabf] hover:text-[#4edea3] flex items-center justify-center transition-colors cursor-pointer"
                        title={webcamSize === 'normal' ? 'Aumentar Webcam' : 'Diminuir Webcam'}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {webcamSize === 'normal' ? 'zoom_in' : 'zoom_out'}
                        </span>
                      </button>
                    )}

                    {/* Botão Expandir / Restaurar */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = webcamSize === 'expanded' ? 'normal' : 'expanded';
                        setWebcamSize(next);
                        onShowToast(
                          next === 'expanded'
                            ? 'Webcam expandida na tela'
                            : 'Tamanho da webcam restaurado',
                          'open_in_full'
                        );
                      }}
                      className="w-6 h-6 rounded-lg bg-[#1c211e] hover:bg-[#262b29] text-[#bbcabf] hover:text-[#4edea3] flex items-center justify-center transition-colors cursor-pointer"
                      title={webcamSize === 'expanded' ? 'Restaurar Tamanho' : 'Expandir Webcam no Palco'}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {webcamSize === 'expanded' ? 'close_fullscreen' : 'open_in_full'}
                      </span>
                    </button>

                    {/* Botão Espelhar Imagem */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsWebcamMirrored(!isWebcamMirrored);
                        onShowToast(
                          !isWebcamMirrored ? 'Espelhamento da webcam ativado' : 'Espelhamento desativado',
                          'flip'
                        );
                      }}
                      className="w-6 h-6 rounded-lg bg-[#1c211e] hover:bg-[#262b29] text-[#bbcabf] hover:text-[#4edea3] flex items-center justify-center transition-colors cursor-pointer"
                      title="Espelhar Imagem Horizontalmente"
                    >
                      <span className="material-symbols-outlined text-[15px]">flip</span>
                    </button>

                    {/* Botão Fechar / Desativar Câmera */}
                    <button
                      type="button"
                      onClick={onToggleCamera}
                      className="w-6 h-6 rounded-lg bg-[#1c211e] hover:bg-[#ffb4ab]/30 text-[#bbcabf] hover:text-[#ffb4ab] flex items-center justify-center transition-colors cursor-pointer"
                      title="Desativar Câmera"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                    </button>
                  </div>
                </div>

                {/* Barra Inferior com Identificação do Usuário */}
                <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 bg-[#0a0f0d]/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#1f332a] text-[10px] font-semibold text-[#dfe4e0]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      !isMuted ? 'bg-[#4edea3] animate-pulse' : 'bg-[#ffb4ab]'
                    }`}
                  ></span>
                  <span>{currentUserName || 'Você'}</span>
                  <span className="text-[#86948a] font-normal">• Ao Vivo</span>
                </div>
              </div>
            </div>
          )}
        </div>

          {/* FLOATING BOTTOM CONTROLS HUD */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-[#1c211e]/90 backdrop-blur-xl border border-[#274237] shadow-[0_10px_35px_rgba(0,0,0,0.8)] transition-all">
            {/* Mic Toggle */}
            <div className="relative group">
              <button
                onClick={onToggleMute}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40'
                    : 'bg-[#262b29] text-[#4edea3] hover:bg-[#353a38] border border-[#1f332a]'
                }`}
                title="Silenciar / Ativar Microfone (Ctrl+D)"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isMuted ? 'mic_off' : 'mic'}
                </span>
              </button>
              {!isMuted && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#4edea3] rounded-full shadow-[0_0_8px_#10b981] animate-pulse"></span>
              )}
            </div>

            {/* Deafen Toggle */}
            <div className="relative group">
              <button
                onClick={onToggleDeafen}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all cursor-pointer ${
                  isDeafened
                    ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40'
                    : 'bg-[#262b29] text-[#dfe4e0] hover:bg-[#353a38] border border-[#1f332a]'
                }`}
                title="Desativar Áudio da Call (Ensurdecer)"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isDeafened ? 'headset_off' : 'headset'}
                </span>
              </button>
            </div>

            {/* Noise Suppression Toggle */}
            <div className="relative group">
              <button
                onClick={onToggleNoiseSuppression}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all cursor-pointer ${
                  isNoiseSuppression
                    ? 'bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/40 shadow-[0_0_12px_rgba(78,222,163,0.3)]'
                    : 'bg-[#262b29] text-[#86948a] hover:bg-[#353a38] border border-[#1f332a]'
                }`}
                title={isNoiseSuppression ? 'Supressão de Ruído Ativada (Clique para desativar)' : 'Supressão de Ruído Desativada (Clique para ativar)'}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isNoiseSuppression ? 'graphic_eq' : 'sound_sampler'}
                </span>
              </button>
            </div>

            {/* HUD Divider */}
            <div className="h-6 w-px bg-[#313633] mx-1"></div>

            {/* Main Action: Screen Share / Source Trigger & Settings */}
            <button
              onClick={() => {
                if (isStreaming) {
                  setShowPresetsMenu(!showPresetsMenu);
                } else {
                  onOpenSourceModal();
                }
              }}
              className={`flex items-center gap-2 px-4 h-11 rounded-xl font-semibold text-xs transition-all shadow-md active:scale-95 cursor-pointer ${
                isStreaming
                  ? 'bg-[#4edea3] text-[#003824] shadow-[0_0_22px_rgba(16,185,129,0.45)] hover:bg-[#00e296]'
                  : 'bg-[#262b29] text-[#bbcabf] hover:bg-[#353a38]'
              }`}
              title={isStreaming ? 'Configurar Resolução e Frames da Transmissão' : 'Iniciar Tela'}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isStreaming ? 'tune' : 'screen_share'}
              </span>
              <span>{isStreaming ? `Transmitindo (${currentPreset.quality})` : 'Iniciar Tela'}</span>
            </button>

            {/* Botão Explícito de Encerrar Transmissão */}
            {isStreaming && (
              <button
                onClick={onToggleStreaming}
                className="flex items-center gap-1.5 px-3.5 h-11 rounded-xl font-semibold text-xs bg-[#ffb4ab]/20 hover:bg-[#ffb4ab] text-[#ffb4ab] hover:text-[#003824] border border-[#ffb4ab]/40 transition-all cursor-pointer shadow-[0_0_12px_rgba(255,180,171,0.2)] active:scale-95"
                title="Encerrar Transmissão"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">stop_screen_share</span>
                <span className="whitespace-nowrap">Encerrar Transmissão</span>
              </button>
            )}

            {/* Camera Toggle (Inicia desativada e abre seleção de webcam do PC) */}
            <div className="relative group">
              <button
                onClick={() => {
                  if (!isCameraOn) {
                    onOpenWebcamModal();
                  } else {
                    onToggleCamera();
                  }
                }}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all cursor-pointer ${
                  !isCameraOn
                    ? 'bg-[#262b29] text-[#86948a] hover:text-[#dfe4e0] hover:bg-[#353a38] border border-[#1f332a]'
                    : 'bg-[#262b29] text-[#4edea3] border border-[#4edea3]/40 shadow-[0_0_12px_rgba(78,222,163,0.3)]'
                }`}
                title={isCameraOn ? 'Desativar Câmera' : 'Selecionar e Ativar Webcam do PC'}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isCameraOn ? 'videocam' : 'videocam_off'}
                </span>
              </button>
            </div>

            {/* Stream Settings / Preset Popover Trigger */}
            <div className="relative" ref={presetsRef}>
              <button
                onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all border border-[#1f332a] ${
                  showPresetsMenu
                    ? 'bg-[#262b29] text-[#4edea3]'
                    : 'bg-[#262b29] text-[#bbcabf] hover:bg-[#353a38] hover:text-[#dfe4e0]'
                }`}
                title="Configurar Resolução e Frames"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">tune</span>
              </button>

              {/* Presets popover */}
              {showPresetsMenu && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-72 p-3.5 rounded-2xl bg-[#1c211e]/95 backdrop-blur-xl border border-[#274237] shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_15px_rgba(16,185,129,0.2)] flex flex-col gap-2.5 z-50 text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center justify-between border-b border-[#262b29] pb-2">
                    <span className="text-xs font-semibold text-[#dfe4e0] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#4edea3]">high_quality</span>
                      <span>Configuração da Transmissão</span>
                    </span>
                    <button
                      onClick={() => setShowPresetsMenu(false)}
                      className="text-[#86948a] hover:text-[#dfe4e0]"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>

                  {/* Resolução Selecionável */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#86948a] uppercase font-semibold">Resolução:</span>
                      <span className="text-[10px] font-mono text-[#4edea3] font-bold">
                        {currentPreset.quality.split(' ')[0]}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {['1080p', '720p', '480p', '360p'].map(res => {
                        const isCurrentRes = currentPreset.quality.includes(res);
                        return (
                          <button
                            key={res}
                            type="button"
                            onClick={() => {
                              const currentFps = currentPreset.fps;
                              const matchedPreset = STREAM_PRESETS.find(p => p.quality.includes(res) && p.fps === currentFps) ||
                                STREAM_PRESETS.find(p => p.quality.includes(res)) ||
                                currentPreset;
                              onSelectPreset(matchedPreset);
                              onShowToast(`Resolução alterada para: ${res} (${currentFps} FPS)`, 'aspect_ratio');
                            }}
                            className={`py-1.5 px-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer text-center ${
                              isCurrentRes
                                ? 'bg-[#4edea3] text-[#003824] shadow-[0_0_10px_rgba(78,222,163,0.35)]'
                                : 'bg-[#181d1a] text-[#86948a] hover:text-[#dfe4e0] border border-[#1f332a]'
                            }`}
                          >
                            {res}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Taxa de Quadros (FPS) Selecionável */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-[#262b29]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#86948a] uppercase font-semibold">Taxa de Quadros (FPS):</span>
                      <span className="text-[10px] font-mono text-[#4edea3] font-bold">
                        {currentPreset.fps} FPS
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[60, 30].map(fps => {
                        const isCurrentFps = currentPreset.fps === fps;
                        return (
                          <button
                            key={fps}
                            type="button"
                            onClick={() => {
                              const currentRes = ['1080p', '720p', '480p', '360p'].find(r => currentPreset.quality.includes(r)) || '1080p';
                              const matchedPreset = STREAM_PRESETS.find(p => p.quality.includes(currentRes) && p.fps === fps) ||
                                STREAM_PRESETS.find(p => p.fps === fps) ||
                                currentPreset;
                              onSelectPreset(matchedPreset);
                              onShowToast(`Taxa de quadros alterada para: ${fps} FPS`, 'speed');
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                              isCurrentFps
                                ? 'bg-[#4edea3] text-[#003824] shadow-[0_0_10px_rgba(78,222,163,0.35)]'
                                : 'bg-[#181d1a] text-[#86948a] hover:text-[#dfe4e0] border border-[#1f332a]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px]">bolt</span>
                            <span>{fps} FPS</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Perfis Completos Pré-configurados */}
                  <div className="flex flex-col gap-1 pt-1 border-t border-[#262b29]">
                    <span className="text-[10px] font-mono text-[#86948a] uppercase font-semibold">Perfis Prontos:</span>
                    <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                      {STREAM_PRESETS.map(preset => {
                        const isSelected = currentPreset.id === preset.id;
                        return (
                          <button
                            key={preset.id}
                            onClick={() => {
                              onSelectPreset(preset);
                              setShowPresetsMenu(false);
                              onShowToast(`Qualidade: ${preset.name}`, 'tune');
                            }}
                            className={`w-full text-left p-1.5 px-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#262b29] border-[#4edea3]/50 text-[#4edea3]'
                                : 'bg-[#181d1a] border-[#1f332a] text-[#dfe4e0] hover:bg-[#262b29]'
                            }`}
                          >
                            <div>
                              <div className="text-[11px] font-semibold">{preset.name}</div>
                              <div className="font-mono text-[9px] text-[#bbcabf]">{preset.bitrate}</div>
                            </div>
                            <span className={`material-symbols-outlined text-[14px] ${isSelected ? 'text-[#4edea3]' : 'text-transparent'}`}>
                              check_circle
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <div className="relative group">
              <button
                onClick={toggleFullscreen}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#262b29] hover:bg-[#353a38] text-[#bbcabf] hover:text-[#dfe4e0] border border-[#1f332a] transition-all"
                title="Tela Cheia (F)"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                </span>
              </button>
            </div>

            {/* HUD Divider */}
            <div className="h-6 w-px bg-[#313633] mx-1"></div>

            {/* Red Disconnect Call Button */}
            <div className="relative group">
              <button
                onClick={onDisconnect}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#ffb4ab]/15 hover:bg-[#ffb4ab] text-[#ffb4ab] hover:text-[#003824] border border-[#ffb4ab]/30 transition-all shadow-[0_0_12px_rgba(255,180,171,0.15)] cursor-pointer"
                title="Desconectar / Sair da Sala"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">call_end</span>
              </button>
            </div>
          </div>
      </section>

      {/* RIGHT SIDEBAR (CHAT INTEGRADO & LISTA DE PARTICIPANTES) */}
      {!isTheaterMode && (
        <aside className="w-full xl:w-80 2xl:w-96 flex flex-col h-full rounded-2xl bg-[#181d1a] border border-[#1f332a] overflow-hidden shadow-xl">
          {/* Tabs switch: Chat vs Roster */}
          <div className="p-2.5 bg-[#181d1a] border-b border-[#1f332a]">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0a0f0d] border border-[#1f332a]">
              <button
                onClick={() => setActiveRightTab('chat')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeRightTab === 'chat'
                    ? 'bg-[#1c211e] text-[#4edea3] shadow-sm'
                    : 'text-[#bbcabf] hover:text-[#dfe4e0]'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">chat_bubble</span>
                <span>Bate-papo da Sala</span>
              </button>

              <button
                onClick={() => setActiveRightTab('roster')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeRightTab === 'roster'
                    ? 'bg-[#1c211e] text-[#4edea3] shadow-sm'
                    : 'text-[#bbcabf] hover:text-[#dfe4e0]'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">group</span>
                <span>Participantes ({participants.length})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: LIVE CHAT */}
          {activeRightTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 relative">
              {/* Notificação Flutuante Elegante que surge no topo do chat quando a transmissão começa */}
              {isStreaming && (
                <div className="mx-3 mt-2 mb-1 p-2 rounded-xl bg-gradient-to-r from-[#10b981]/20 via-[#10b981]/15 to-[#00e296]/20 border border-[#4edea3]/40 shadow-[0_4px_20px_rgba(16,185,129,0.25)] flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-[#4edea3] text-[#003824] flex items-center justify-center shrink-0 shadow-sm">
                      <span className="material-symbols-outlined text-[15px]">sensors</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-[#dfe4e0] truncate">
                        {activeStreams[0]?.participantName || currentUserName || 'Você'} iniciou uma transmissão!
                      </span>
                      <span className="text-[9px] font-mono text-[#4edea3] truncate">
                        {currentPreset.quality} • {currentPreset.fps} FPS • Ao Vivo na Sala
                      </span>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-[#4edea3]/20 text-[#4edea3] font-mono text-[9px] font-bold shrink-0 border border-[#4edea3]/30">
                    AO VIVO
                  </span>
                </div>
              )}

              {/* Messages list */}
              <div className="flex-1 p-3 sm:p-4 overflow-y-auto flex flex-col gap-3.5 space-y-1">
                {chatMessages.map(msg => {
                  if (msg.isSystem) {
                    return (
                      <div
                        key={msg.id}
                        className="flex items-center gap-1.5 py-1 px-3 rounded-lg bg-[#1c211e]/70 border border-[#1f332a] self-center text-center max-w-full"
                      >
                        <span className="material-symbols-outlined text-[#4edea3] text-[13px]">login</span>
                        <span className="font-mono text-[11px] text-[#bbcabf]">{msg.text}</span>
                      </div>
                    );
                  }

                  if (msg.isStreamLog) {
                    return (
                      <div
                        key={msg.id}
                        className="flex items-center gap-1.5 py-1 px-3 rounded-lg bg-[#10b981]/15 border border-[#10b981]/30 self-center text-center max-w-full"
                      >
                        <span className="material-symbols-outlined text-[#4edea3] text-[13px]">screen_share</span>
                        <span className="font-mono text-[11px] text-[#4edea3] font-semibold">{msg.text}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex items-start gap-2.5 group">
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-[#262b29] border border-[#1f332a]">
                        <AvatarImage
                          src={msg.senderAvatar}
                          alt={msg.senderName}
                          fallbackText={msg.senderName}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className={`text-xs font-bold ${msg.senderRole === 'STREAMER' ? 'text-[#4edea3]' : 'text-[#dfe4e0]'}`}>
                            {msg.senderName}
                          </span>
                          {msg.senderRole === 'STREAMER' && (
                            <span className="px-1.5 py-0.2 rounded bg-[#10b981]/20 text-[#4edea3] text-[9px] font-mono font-bold">
                              TRANSMISSOR
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-[#86948a]">{msg.time}</span>
                        </div>

                        <p className="text-xs text-[#dfe4e0] mt-0.5 leading-relaxed break-words">
                          {msg.text.includes('Arc<RwLock>') ? (
                            <>
                              Sim! Olha a linha 142 no VS Code ali. Fiz o cache do buffer usando{' '}
                              <span className="px-1.5 py-0.5 rounded bg-[#1c211e] border border-[#274237] text-[#4edea3] font-mono text-[11px]">
                                Arc&lt;RwLock&gt;
                              </span>
                              .
                            </>
                          ) : (
                            msg.text
                          )}
                        </p>

                        {/* Interactive Reactions */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {msg.reactions.map(r => (
                              <button
                                key={r.emoji}
                                onClick={() => onToggleReaction(msg.id, r.emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-all ${
                                  r.hasReacted
                                    ? 'bg-[#10b981]/20 border-[#4edea3] text-[#4edea3]'
                                    : 'bg-[#1c211e] border-[#1f332a] text-[#bbcabf] hover:border-[#274237]'
                                }`}
                              >
                                <span>{r.emoji}</span>
                                <span className="font-mono text-[10px]">{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div ref={chatMessagesEndRef} />
              </div>



              {/* Chat Input form */}
              <div className="p-3 bg-[#181d1a] border-t border-[#1f332a]">
                <form
                  onSubmit={handleChatSubmit}
                  className="relative flex items-center bg-[#1c211e] border border-[#1f332a] focus-within:border-[#4edea3] rounded-xl overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setChatInputText(prev => prev + ' 📸 [Screenshot_Debug_RenderPass.png]');
                      onShowToast('Captura de tela anexada ao chat', 'attachment');
                    }}
                    className="p-2 text-[#bbcabf] hover:text-[#4edea3] transition-colors"
                    title="Anexar arquivo ou print"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  </button>

                  <input
                    type="text"
                    value={chatInputText}
                    onChange={e => setChatInputText(e.target.value)}
                    placeholder="Enviar mensagem para #dev-gaming-live..."
                    className="flex-1 bg-transparent py-2.5 px-1.5 text-xs text-[#dfe4e0] placeholder:text-[#86948a] outline-none"
                  />

                  <div className="flex items-center pr-1.5">
                    <button
                      type="button"
                      onClick={() => setChatInputText(prev => prev + ' 🔥')}
                      className="p-1.5 text-[#bbcabf] hover:text-[#4edea3] transition-colors"
                      title="Inserir Emoji 🔥"
                    >
                      <span className="material-symbols-outlined text-[18px]">mood</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!chatInputText.trim()}
                      className="p-1.5 text-[#4edea3] hover:text-[#00ffaa] disabled:opacity-40 transition-colors cursor-pointer"
                      title="Enviar"
                    >
                      <span className="material-symbols-outlined text-[18px]">send</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: PARTICIPANTS ROSTER */}
          {activeRightTab === 'roster' && (
            <div className="flex-1 flex flex-col p-4 overflow-y-auto gap-3">
              <span className="text-[11px] font-semibold text-[#86948a] uppercase tracking-wider px-1">
                Transmitindo Tela ({activeStreams.length > 0 ? 1 : 0})
              </span>

              {/* Host Card */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1c211e] border border-[#4edea3]/30 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-[#10b981]/20 border border-[#4edea3]/40 flex items-center justify-center font-bold text-[#4edea3] text-sm overflow-hidden">
                      <AvatarImage
                        src={activeStreams[0]?.participantAvatar}
                        alt="Host"
                        fallbackText={activeStreams[0]?.participantName || currentUserName || 'U'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#4edea3] ring-2 ring-[#1c211e]"></span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-[#dfe4e0] truncate">
                        {activeStreams[0]?.participantName || currentUserName || 'Anfitrião'}
                      </span>
                      <span className="material-symbols-outlined text-[14px] text-[#4edea3]">screen_share</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#4edea3]">Anfitrião da Sessão • Ao Vivo</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[#4edea3]">
                  <span className="material-symbols-outlined text-[18px]">
                    {!isMuted ? 'mic' : 'mic_off'}
                  </span>
                </div>
              </div>

              {/* Espectadores Reais Conectados na Sala */}
              {(() => {
                const realSpectators = participants.filter(
                  p => (currentUserId ? p.id !== currentUserId : !p.name.includes('(Você)'))
                );

                return (
                  <>
                    <span className="text-[11px] font-semibold text-[#86948a] uppercase tracking-wider px-1 mt-2">
                      Espectadores Reais ({realSpectators.length})
                    </span>

                    {realSpectators.length === 0 ? (
                      <div className="p-4 rounded-xl bg-[#0a0f0d] border border-[#1f332a] text-center flex flex-col items-center gap-1.5 my-2">
                        <span className="material-symbols-outlined text-[#86948a] text-[22px]">group</span>
                        <p className="text-xs text-[#86948a]">Nenhum outro espectador na sala</p>
                        <span className="text-[10px] text-[#bbcabf]">
                          Apenas pessoas reais que conectarem nesta sala aparecerão aqui.
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {realSpectators.map(spectator => {
                          const cleanName = spectator.name.replace(/\s*\(Você\)\s*/g, '').trim();
                          return (
                            <div
                              key={spectator.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-[#0a0f0d] border border-[#1f332a] hover:bg-[#1c211e] transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative">
                                  <div className="w-8 h-8 rounded-full bg-[#262b29] flex items-center justify-center font-bold text-[#dfe4e0] text-xs overflow-hidden">
                                    <AvatarImage
                                      src={spectator.avatar}
                                      alt={cleanName}
                                      fallbackText={cleanName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <span
                                    className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
                                      spectator.isMuted ? 'bg-[#ffb4ab]' : 'bg-[#4edea3]'
                                    } ring-2 ring-[#0a0f0d]`}
                                  ></span>
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-medium text-[#dfe4e0] truncate">
                                    {cleanName}
                                  </span>
                                  <span className="font-mono text-[10px] text-[#bbcabf]">
                                    {spectator.isMuted ? 'Mutado' : 'Conectado'}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`material-symbols-outlined text-[16px] ${
                                  spectator.isMuted ? 'text-[#ffb4ab]' : 'text-[#4edea3]'
                                }`}
                              >
                                {spectator.isMuted ? 'mic_off' : 'mic'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </aside>
      )}
    </div>
  );
};
