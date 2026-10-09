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
  const localStream = webRtcMesh.getLocalStream();
  const isOwnStream = Boolean(
    (currentUserId && (stream.participantId === currentUserId || stream.id.includes(currentUserId))) ||
    stream.id.includes('main-user') ||
    stream.participantName?.includes('(Você)') ||
    (localStream && (stream.mediaStream === localStream || stream.id.includes('main-user')))
  );

  // Stream efetivo a reproduzir: se for o próprio emissor, utiliza o stream local capturado de imediato
  const effectiveStream = isOwnStream ? (stream.mediaStream || localStream) : stream.mediaStream;

  // Por padrão o áudio do elemento de vídeo começa mutado para garantir Autoplay imediato sem tela preta
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [hasAutoplayBlocked, setHasAutoplayBlocked] = useState<boolean>(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(() => Boolean(isOwnStream));

  // Inicia ou restaura a reprodução de vídeo WebRTC com muted, playsinline e autoplay imediatos
  const attemptPlay = useCallback(async (forceMuted = true) => {
    const videoEl = videoRef.current;
    const streamToPlay = isOwnStream ? (effectiveStream || localStream) : effectiveStream;
    if (!videoEl || !streamToPlay) return;

    if (videoEl.srcObject !== streamToPlay) {
      videoEl.srcObject = streamToPlay;
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
  }, [effectiveStream, isOwnStream, isAudioMuted, localStream]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // 1. Exibição Local Direta:
    // Se o usuário atual for o emissor, atribui imediatamente o stream local capturado à tag <video>
    // sem aguardar eventos de rede WebRTC ou ontrack
    if (isOwnStream) {
      const streamToPlay = effectiveStream || localStream;
      if (streamToPlay) {
        if (videoEl.srcObject !== streamToPlay) {
          videoEl.srcObject = streamToPlay;
        }
        videoEl.muted = true;
        videoEl.defaultMuted = true;
        videoEl.playsInline = true;
        videoEl.play().catch((err) => console.warn('Preview local play warning:', err));
        setIsVideoPlaying(true);
      }
      return;
    }

    // 2. Fluxo para espectadores remotos: registra elemento para ontrack e aguarda quadros
    webRtcMesh.registerVideoElement(stream.participantId, videoEl);

    if (effectiveStream) {
      if (videoEl.srcObject !== effectiveStream) {
        videoEl.srcObject = effectiveStream;
      }
      videoEl.muted = isAudioMuted;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;

      videoEl.play().then(() => {
        setIsVideoPlaying(true);
      }).catch((err) => console.warn('Erro ao reproduzir vídeo remoto:', err));

      const tracks = effectiveStream.getTracks();
      const handleTrackActive = () => {
        if (videoEl && effectiveStream) {
          if (videoEl.srcObject !== effectiveStream) {
            videoEl.srcObject = effectiveStream;
          }
          videoEl.play().then(() => {
            setIsVideoPlaying(true);
          }).catch((err) => console.warn('Erro ao reproduzir vídeo:', err));
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
  }, [stream.participantId, stream.mediaStream, effectiveStream, isOwnStream, isAudioMuted, localStream]);

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
              <span className={`flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[9px] font-bold border ${
                isOwnStream
                  ? 'bg-[#1f332a]/80 text-[#4edea3] border-[#274237]'
                  : 'bg-[#0a0f0d]/80 text-[#4edea3] border-[#1f332a]'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                {isOwnStream ? 'SUA TELA' : 'AO VIVO'}
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
            if (isOwnStream) {
              const streamToPlay = effectiveStream || localStream;
              if (el && streamToPlay) {
                if (el.srcObject !== streamToPlay) {
                  el.srcObject = streamToPlay;
                }
                el.muted = true;
                el.defaultMuted = true;
                el.playsInline = true;
                el.play().catch(() => {});
                setIsVideoPlaying(true);
              }
            } else {
              webRtcMesh.registerVideoElement(stream.participantId, el);
              if (el && effectiveStream) {
                if (el.srcObject !== effectiveStream) {
                  el.srcObject = effectiveStream;
                }
                el.play().then(() => {
                  setIsVideoPlaying(true);
                }).catch((err) => console.warn('Erro ao reproduzir vídeo:', err));
              }
            }
          }}
          autoPlay
          playsInline
          muted={isOwnStream || isAudioMuted}
          onPlaying={() => setIsVideoPlaying(true)}
          onLoadedData={() => setIsVideoPlaying(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />

        {/* Loading Overlay: Sincronizando vídeo ao vivo WebRTC...
            Apenas para espectadores remotos enquanto os dados de vídeo não chegarem.
            O transmissor (isOwnStream) NUNCA vê este estado de carregamento. */}
        {!isOwnStream && (!effectiveStream || !isVideoPlaying) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-br from-[#0c120f]/95 via-[#101713]/95 to-[#18221b]/95 backdrop-blur-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#1c211e] border border-[#274237] flex items-center justify-center text-[#4edea3] mb-3 shadow-[0_0_25px_rgba(78,222,163,0.2)] animate-pulse">
              <span className="material-symbols-outlined text-[28px]">sensors</span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-[#dfe4e0]">
              Transmissão de {stream.participantName}
            </div>
            <div className="text-[11px] text-[#4edea3] font-mono mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-ping"></span>
              <span>Sincronizando vídeo ao vivo WebRTC...</span>
            </div>
          </div>
        )}

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
          <span>{isOwnStream ? 'Captura Local' : 'WebRTC P2P'}</span>
        </span>
      </div>
    </div>
  );
});
