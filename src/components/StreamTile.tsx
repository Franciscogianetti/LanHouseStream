import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ActiveStream } from '../types/stream';
import { AvatarImage } from './AvatarImage';
import { webRtcMesh } from '../services/webRtcMesh';

interface StreamTileProps {
  stream: ActiveStream;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  currentUserId?: string;
}

export const StreamTile: React.FC<StreamTileProps> = React.memo(({
  stream,
  isMaximized,
  onToggleMaximize,
  onClose,
  onShowToast,
  currentUserId,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isOwnStream = Boolean(currentUserId && stream.participantId === currentUserId);

  // Por padrão o áudio do elemento de vídeo começa mutado para garantir Autoplay imediato sem tela preta
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [hasAutoplayBlocked, setHasAutoplayBlocked] = useState<boolean>(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);

  // Inicia ou restaura a reprodução de vídeo WebRTC com muted, playsinline e autoplay imediatos
  const attemptPlay = useCallback(async (forceMuted = true) => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream.mediaStream) return;

    if (videoEl.srcObject !== stream.mediaStream) {
      videoEl.srcObject = stream.mediaStream;
    }

    // Por predefinição garante muted e playsInline para que o navegador sincronize imediatamente sem exigir gesto de áudio
    const shouldMute = isOwnStream || forceMuted || isAudioMuted;
    videoEl.muted = shouldMute;
    videoEl.defaultMuted = shouldMute;
    videoEl.playsInline = true;

    try {
      await videoEl.play();
      setIsVideoPlaying(true);
      if (!shouldMute) {
        setHasAutoplayBlocked(false);
      }
    } catch (err: any) {
      console.warn('[StreamTile] Tentando reproduzir com áudio falhou. Ativando fallback mudo obrigatório:', err?.message || err);
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;
      setIsAudioMuted(true);
      setHasAutoplayBlocked(true);
      try {
        await videoEl.play();
        setIsVideoPlaying(true);
      } catch (innerErr) {
        console.error('[StreamTile] Falha no fallback mudo:', innerErr);
      }
    }
  }, [stream.mediaStream, isOwnStream, isAudioMuted]);

  useEffect(() => {
    webRtcMesh.registerVideoElement(stream.participantId, videoRef.current);

    const videoEl = videoRef.current;
    if (videoEl && stream.mediaStream) {
      if (videoEl.srcObject !== stream.mediaStream) {
        videoEl.srcObject = stream.mediaStream;
      }
      videoEl.muted = isOwnStream || isAudioMuted;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;

      videoEl.play().catch((err) => console.warn('Erro ao reproduzir vídeo:', err));

      const tracks = stream.mediaStream.getTracks();
      const handleTrackActive = () => {
        if (videoEl && stream.mediaStream) {
          if (videoEl.srcObject !== stream.mediaStream) {
            videoEl.srcObject = stream.mediaStream;
          }
          videoEl.play().catch((err) => console.warn('Erro ao reproduzir vídeo:', err));
        }
      };

      tracks.forEach(track => {
        track.addEventListener('unmute', handleTrackActive);
        track.addEventListener('ended', handleTrackActive);
      });

      return () => {
        tracks.forEach(track => {
          track.removeEventListener('unmute', handleTrackActive);
          track.removeEventListener('ended', handleTrackActive);
        });
        webRtcMesh.unregisterVideoElement(stream.participantId);
      };
    }

    return () => {
      webRtcMesh.unregisterVideoElement(stream.participantId);
    };
  }, [stream.participantId, stream.mediaStream, isOwnStream, isAudioMuted]);

  // Alternar áudio do stream (ativar som ou silenciar) com gesto direto do usuário
  const handleToggleAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const nextMuted = !isAudioMuted;
    videoEl.muted = nextMuted;
    setIsAudioMuted(nextMuted);

    if (!nextMuted) {
      setHasAutoplayBlocked(false);
      videoEl.play().then(() => {
        setIsVideoPlaying(true);
        onShowToast(`Áudio de ${stream.participantName} ativado`, 'volume_up');
      }).catch(() => {
        videoEl.muted = true;
        setIsAudioMuted(true);
      });
    } else {
      onShowToast(`Áudio de ${stream.participantName} silenciado`, 'volume_off');
    }
  };

  // Clique no container do vídeo despausa e ativa som caso tenha sido bloqueado
  const handleVideoAreaClick = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (videoEl.paused) {
      videoEl.play().catch(() => {});
    }

    if (!isOwnStream && hasAutoplayBlocked) {
      handleToggleAudio();
    }
  };

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden bg-[#181d1a] border transition-all flex flex-col w-full h-full min-h-0 ${
        isMaximized
          ? 'border-[#4edea3] shadow-[0_0_30px_rgba(78,222,163,0.3)] z-40'
          : 'border-[#1f332a] hover:border-[#274237] shadow-xl hover:shadow-2xl'
      }`}
    >
      {/* Top Overlay Bar */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-2.5 sm:p-3 bg-gradient-to-b from-[#0a0f0d]/90 via-[#0a0f0d]/50 to-transparent">
        {/* Streamer info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#262b29] border border-[#274237] flex items-center justify-center text-[10px] font-bold text-[#4edea3] shrink-0 overflow-hidden">
            <AvatarImage
              src={stream.participantAvatar}
              alt={stream.participantName}
              fallbackText={stream.participantName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#dfe4e0] truncate drop-shadow-sm">
                {stream.participantName}
              </span>
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#0a0f0d]/80 text-[#4edea3] font-mono text-[9px] font-bold border border-[#1f332a]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                AO VIVO
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#bbcabf] truncate">
              {stream.title}
            </span>
          </div>
        </div>

        {/* Action Controls: Áudio, Maximizar e Fechar (X) */}
        <div className="flex items-center gap-1.5 shrink-0 bg-[#0a0f0d]/70 backdrop-blur-md p-1 rounded-xl border border-[#1f332a]">
          {/* Botão de Áudio da Transmissão (apenas para espectadores) */}
          {!isOwnStream && (
            <button
              type="button"
              onClick={handleToggleAudio}
              className={`w-7 h-7 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
                isAudioMuted
                  ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] hover:bg-[#ffb4ab]/30'
                  : 'bg-[#1c211e] hover:bg-[#262b29] text-[#4edea3]'
              }`}
              title={isAudioMuted ? 'Clique para Ativar o Áudio' : 'Silenciar Áudio'}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isAudioMuted ? 'volume_off' : 'volume_up'}
              </span>
            </button>
          )}

          {/* Botão Maximizar / Restaurar */}
          <button
            type="button"
            onClick={onToggleMaximize}
            className="w-7 h-7 rounded-lg bg-[#1c211e] hover:bg-[#262b29] text-[#bbcabf] hover:text-[#4edea3] transition-colors flex items-center justify-center cursor-pointer"
            title={isMaximized ? 'Restaurar para a Grade' : 'Maximizar esta Tela'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isMaximized ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>

          {/* Botão Fechar Transmissão (X) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onShowToast(`Transmissão de ${stream.participantName} fechada`, 'close');
            }}
            className="w-7 h-7 rounded-lg bg-[#1c211e] hover:bg-[#ffb4ab]/20 text-[#bbcabf] hover:text-[#ffb4ab] transition-colors flex items-center justify-center cursor-pointer"
            title="Fechar esta transmissão da visualização"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>

      {/* Main Stream Video Area */}
      <div
        onClick={handleVideoAreaClick}
        className="relative w-full flex-1 min-h-0 flex items-center justify-center bg-[#0a0f0d] overflow-hidden cursor-pointer"
      >
        <video
          ref={(el) => {
            videoRef.current = el;
            webRtcMesh.registerVideoElement(stream.participantId, el);
            if (el && stream.mediaStream) {
              if (el.srcObject !== stream.mediaStream) {
                el.srcObject = stream.mediaStream;
              }
              el.play().catch((err) => console.warn('Erro ao reproduzir vídeo:', err));
            }
          }}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />

        {/* Aviso Flutuante se o Chrome tiver pausado o áudio por Autoplay */}
        {!isOwnStream && hasAutoplayBlocked && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <button
              type="button"
              onClick={handleToggleAudio}
              className="px-3.5 py-1.5 rounded-xl bg-[#1c211e]/90 hover:bg-[#262b29] text-[#4edea3] border border-[#274237] shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-md flex items-center gap-2 text-xs font-semibold transition-all hover:scale-105 cursor-pointer animate-pulse"
            >
              <span className="material-symbols-outlined text-[18px]">volume_off</span>
              <span>Clique aqui para ativar o áudio</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom telemetry footer inside card */}
      <div className="px-3 py-1.5 bg-[#141916] border-t border-[#1f332a] flex items-center justify-between text-[10px] font-mono text-[#86948a] z-20">
        <span className="text-[#bbcabf]">{stream.resolution || '1920 x 1080'} • {stream.fps || '60 FPS'}</span>
        <span className="text-[#4edea3] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
          <span>WebRTC P2P</span>
        </span>
      </div>
    </div>
  );
});
