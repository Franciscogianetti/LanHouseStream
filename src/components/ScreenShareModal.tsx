import React, { useState } from 'react';
import { StreamSource } from '../types/stream';
import { STREAM_SOURCES, REAL_PC_HARDWARE } from '../data/mockData';

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSource: StreamSource;
  onSelectSource: (source: StreamSource, audioCaptured: boolean, audioGain: number, realStream?: MediaStream) => void;
}

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  isOpen,
  onClose,
  currentSource,
  onSelectSource,
}) => {
  const [sourcesList, setSourcesList] = useState<StreamSource[]>(STREAM_SOURCES);
  const [activeCategory, setActiveCategory] = useState<'screens' | 'apps'>('screens');
  const [selectedSourceId, setSelectedSourceId] = useState<string>(currentSource.id);
  const [audioActive, setAudioActive] = useState(true);
  const [volumeGain, setVolumeGain] = useState(100);
  const [isStarting, setIsStarting] = useState(false);

  // Seletores de Resolução (Máx 1080p) e FPS (Máx 60 FPS)
  const [selectedResolution, setSelectedResolution] = useState<'1080p' | '720p' | '480p' | '360p'>('1080p');
  const [selectedFps, setSelectedFps] = useState<60 | 30>(60);
  const [selectedMode, setSelectedMode] = useState<'game' | 'fluid' | 'balanced'>('game');

  if (!isOpen) return null;

  const currentSources = sourcesList.filter(s => s.category === activeCategory);
  const selectedSource = sourcesList.find(s => s.id === selectedSourceId) || sourcesList[0];

  // Identificação automatizada de mais telas (Tela 3, Tela 4, Tela 5...)
  const handleDetectMoreScreens = () => {
    const currentScreensCount = sourcesList.filter(s => s.category === 'screens').length;
    const nextScreenIndex = currentScreensCount + 1;
    const newScreenId = `screen-${nextScreenIndex}`;
    const newScreenSource: StreamSource = {
      id: newScreenId,
      name: `Tela ${nextScreenIndex} (Auxiliar Detectada)`,
      category: 'screens',
      resolution: '1920 x 1080',
      fps: '60 FPS',
      subtext: `1920 x 1080 • GPU: RTX 4060 • Tela ${nextScreenIndex}`,
      image: selectedSource.image,
      icon: 'desktop_windows',
      gpuOrPipe: 'GPU: RTX 4060',
      badge: `Tela ${nextScreenIndex}`,
    };
    setSourcesList(prev => [...prev, newScreenSource]);
    setSelectedSourceId(newScreenId);
  };

  // Captura direta de janela do PC via navegador nativo (getDisplayMedia)
  const handlePickNativeWindow = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        setIsStarting(true);
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } catch (audioErr: any) {
          if (audioErr?.name === 'NotAllowedError') throw audioErr;
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
        }

        const track = stream.getVideoTracks()[0];
        const windowTitle = track.label || (activeCategory === 'apps' ? 'Janela Selecionada do PC' : 'Tela do Sistema');
        const resText = selectedResolution === '1080p' ? '1920 x 1080' : selectedResolution === '720p' ? '1280 x 720' : selectedResolution === '480p' ? '854 x 480' : '640 x 360';
        const customSource: StreamSource = {
          id: `custom-native-${Date.now()}`,
          name: windowTitle,
          category: activeCategory,
          resolution: resText,
          fps: `${selectedFps} FPS`,
          subtext: `Janela Ativa • Captura Real do Windows (${selectedResolution})`,
          image: selectedSource.image,
          icon: activeCategory === 'apps' ? 'widgets' : 'desktop_windows',
          badge: `${selectedResolution} ${selectedFps}FPS`,
        };

        onSelectSource(customSource, stream.getAudioTracks().length > 0, volumeGain, stream);
        setIsStarting(false);
        onClose();
        return;
      } catch {
        setIsStarting(false);
        // Usuário cancelou o seletor do navegador
      }
    }
  };

  const handleStartStream = async () => {
    setIsStarting(true);

    const formattedRes = selectedResolution === '1080p' ? '1920 x 1080' : selectedResolution === '720p' ? '1280 x 720' : selectedResolution === '480p' ? '854 x 480' : '640 x 360';
    let realStream: MediaStream | undefined;
    let finalSource: StreamSource = {
      ...selectedSource,
      resolution: formattedRes,
      fps: `${selectedFps} FPS`,
      badge: selectedMode === 'game' ? 'Modo Jogo 60FPS' : `${selectedResolution} ${selectedFps}FPS`,
    };

    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        try {
          realStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } catch (audioErr: any) {
          if (audioErr?.name === 'NotAllowedError') throw audioErr;
          realStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
        }

        const track = realStream.getVideoTracks()[0];
        if (track && track.label) {
          finalSource = {
            ...finalSource,
            name: track.label,
            subtext: `Janela/Tela Ativa • Captura Real (${selectedResolution})`,
          };
        }
      } catch (err) {
        console.warn('Prompt de captura real cancelado ou negado:', err);
      }
    }

    onSelectSource(finalSource, audioActive, volumeGain, realStream);
    setIsStarting(false);
    onClose();
  };

  const screensCount = sourcesList.filter(s => s.category === 'screens').length;
  const appsCount = sourcesList.filter(s => s.category === 'apps').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0a0f0d]/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-[#181d1a] border border-[#274237] rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Glow ambient background element */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#10b981]/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Section */}
        <div className="p-5 sm:p-6 pb-4 flex items-start justify-between gap-4 relative">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] shadow-[0_0_8px_#10b981] animate-pulse"></span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#4edea3] font-semibold">
                Transmissão P2P • GPU {REAL_PC_HARDWARE.gpu}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#dfe4e0] tracking-tight">
              Compartilhar sua Tela ou Janela
            </h2>
            <p className="text-xs sm:text-sm text-[#bbcabf]">
              Transmita suas telas ou apenas a janela desejada (ex: YouTube) sem expor outras abas ou áreas do PC.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar Janela"
            className="w-8 h-8 rounded-lg bg-[#1c211e] text-[#bbcabf] hover:bg-[#262b29] hover:text-[#dfe4e0] border border-[#1f332a] transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Category Filter Tabs: Apenas Telas do Sistema e Janelas de Aplicativos */}
        <div className="px-5 sm:px-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0a0f0d] border border-[#1f332a]">
            <button
              onClick={() => setActiveCategory('screens')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'screens'
                  ? 'bg-[#262b29] text-[#4edea3] shadow-sm border border-[#274237]'
                  : 'text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#181d1a]'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">desktop_windows</span>
              <span>Telas do Sistema</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#0a0f0d] text-[#4edea3] font-mono text-[10px]">
                {screensCount}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('apps')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'apps'
                  ? 'bg-[#262b29] text-[#4edea3] shadow-sm border border-[#274237]'
                  : 'text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#181d1a]'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">widgets</span>
              <span>Janelas de Aplicativos</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#1c211e] text-[#bbcabf] font-mono text-[10px]">
                {appsCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeCategory === 'screens' ? (
              <button
                type="button"
                onClick={handleDetectMoreScreens}
                className="px-3 py-1.5 rounded-lg bg-[#262b29] hover:bg-[#353a38] text-[#4edea3] border border-[#1f332a] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Detecta se você ou alguém da call tem 3, 4 ou mais telas conectadas"
              >
                <span className="material-symbols-outlined text-[16px]">add_to_queue</span>
                <span>Detectar Novas Telas</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePickNativeWindow}
                className="px-3 py-1.5 rounded-lg bg-[#262b29] hover:bg-[#353a38] text-[#4edea3] border border-[#1f332a] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abre o seletor nativo do Windows para escolher qualquer janela ou aba aberta"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_browser</span>
                <span>Selecionar Janela no Meu PC</span>
              </button>
            )}
          </div>
        </div>

        {/* Sources Cards Viewport */}
        <div className="p-5 sm:p-6 flex-1 max-h-[380px] overflow-y-auto">
          {activeCategory === 'apps' && (
            <div className="p-3 mb-3 rounded-xl bg-[#1c211e] border border-[#274237] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#4edea3] text-[20px]">verified_user</span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#dfe4e0]">Modo Janela Isolada Ativo</span>
                  <span className="text-[11px] text-[#bbcabf]">
                    Ao transmitir uma janela (ex: YouTube), suas outras abas e mensagens do WhatsApp/Discord não aparecem na chamada.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Cards grid */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {currentSources.map(source => {
              const isSelected = selectedSourceId === source.id;
              return (
                <div
                  key={source.id}
                  onClick={() => setSelectedSourceId(source.id)}
                  className={`group cursor-pointer rounded-xl p-3.5 transition-all relative overflow-hidden flex flex-col justify-between border ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#1c211e] to-[#262b29] border-[#4edea3] shadow-[0_0_20px_rgba(78,222,163,0.25)]'
                      : 'bg-[#1c211e] border-[#1f332a] hover:bg-[#262b29] hover:border-[#274237]'
                  }`}
                >
                  {/* Selected Pill */}
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded bg-[#4edea3] text-[#003824] font-mono font-bold text-[10px] shadow-sm">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                      <span>SELECIONADA</span>
                    </div>
                  )}

                  {/* Thumbnail */}
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-[#0a0f0d] mb-2.5 flex flex-col justify-end">
                    <img
                      src={source.image}
                      alt={source.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f0d]/85 via-transparent to-transparent pointer-events-none"></div>
                    
                    {/* Badge tags overlay */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-[#0a0f0d]/90 text-[#4edea3] font-mono text-[10px]">
                        {source.fps}
                      </span>
                      {source.badge && (
                        <span className="px-1.5 py-0.5 rounded bg-[#0a0f0d]/90 text-[#bbcabf] font-mono text-[10px]">
                          {source.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info Row */}
                  <div className="flex items-start justify-between gap-2 mt-1">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-[#dfe4e0] truncate group-hover:text-[#4edea3] transition-colors">
                        {source.name}
                      </span>
                      <span className={`font-mono text-[10px] truncate ${isSelected ? 'text-[#4edea3]' : 'text-[#86948a]'}`}>
                        {source.subtext}
                      </span>
                    </div>
                    <span className={`material-symbols-outlined text-[18px] shrink-0 ${isSelected ? 'text-[#4edea3]' : 'text-[#86948a]'}`}>
                      {source.icon}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seletor Rápido de Resolução, FPS e Modo antes de Iniciar */}
        <div className="px-5 sm:px-6 py-3 bg-[#181d1a] border-t border-[#1f332a] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#dfe4e0] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#4edea3]">tune</span>
              <span>Qualidade:</span>
            </span>

            {/* Resolução */}
            <div className="flex items-center gap-1 bg-[#0a0f0d] p-0.5 rounded-lg border border-[#1f332a]">
              {(['1080p', '720p', '480p', '360p'] as const).map(res => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setSelectedResolution(res)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                    selectedResolution === res
                      ? 'bg-[#262b29] text-[#4edea3]'
                      : 'text-[#86948a] hover:text-[#dfe4e0]'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>

            {/* Frames (FPS) */}
            <div className="flex items-center gap-1 bg-[#0a0f0d] p-0.5 rounded-lg border border-[#1f332a]">
              {([60, 30] as const).map(fps => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => setSelectedFps(fps)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                    selectedFps === fps
                      ? 'bg-[#262b29] text-[#4edea3]'
                      : 'text-[#86948a] hover:text-[#dfe4e0]'
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          {/* Modo Fluido / Modo Jogo */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSelectedMode('game');
                setSelectedResolution('1080p');
                setSelectedFps(60);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                selectedMode === 'game'
                  ? 'bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/40'
                  : 'bg-[#1c211e] text-[#bbcabf] border border-[#1f332a] hover:text-[#dfe4e0]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">sports_esports</span>
              <span>Modo Jogo Ultra Fluido</span>
            </button>
          </div>
        </div>

        {/* Audio Toggle & Volume Boost Module */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#0a0f0d] border-t border-[#1f332a] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              role="switch"
              aria-checked={audioActive}
              onClick={() => setAudioActive(!audioActive)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors relative flex items-center cursor-pointer shrink-0 ${
                audioActive ? 'bg-[#10b981]' : 'bg-[#262b29]'
              }`}
              type="button"
            >
              <span
                className={`w-5 h-5 rounded-full bg-[#0a0f0d] shadow-sm transition-transform ${
                  audioActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#dfe4e0]">Capturar Áudio da Janela/Sistema</span>
                <span className="material-symbols-outlined text-[#4edea3] text-[15px]">volume_up</span>
              </div>
              <span className="text-[11px] text-[#bbcabf]">
                Inclui o som do YouTube, jogos ou players com controle de ganho
              </span>
            </div>
          </div>

          {/* Volume Booster Slider */}
          <div className="flex items-center gap-2 bg-[#1c211e] px-3 py-1.5 rounded-lg border border-[#1f332a] min-w-[210px]">
            <span className="material-symbols-outlined text-[#86948a] text-[16px]">equalizer</span>
            <span className="font-mono text-[10px] text-[#86948a] shrink-0 font-semibold">GANHO</span>
            <input
              type="range"
              min="0"
              max="150"
              value={volumeGain}
              onChange={e => setVolumeGain(Number(e.target.value))}
              className="w-full accent-[#4edea3] h-1.5 bg-[#262b29] rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[11px] text-[#4edea3] font-semibold w-10 text-right">
              {volumeGain}%
            </span>
          </div>
        </div>

        {/* Telemetry Bar */}
        <div className="px-5 sm:px-6 py-2 bg-[#1c211e] border-t border-[#1f332a] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 sm:gap-4 font-mono text-[11px]">
            <div className="flex items-center gap-1">
              <span className="text-[#86948a]">RESOLUÇÃO:</span>
              <span className="text-[#4edea3] font-semibold">{selectedResolution} (Máx 1080p)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#86948a]">QUADROS:</span>
              <span className="text-[#4edea3] font-semibold">{selectedFps} FPS (Máx 60 FPS)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#86948a]">ENCODER:</span>
              <span className="text-[#00e296] font-semibold">NVENC RTX 4060</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[#4edea3] font-mono text-[11px]">
            <span className="material-symbols-outlined text-[13px]">bolt</span>
            <span>Sem travamentos • Latência: ~12ms</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#181d1a] border-t border-[#1f332a]">
          <div className="flex items-center gap-1.5 text-[#86948a] text-xs">
            <span className="material-symbols-outlined text-[16px] text-[#4edea3]">privacy_tip</span>
            <span>Transmissão segura de janela única em tempo real.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#bbcabf] hover:text-[#dfe4e0] bg-[#1c211e] hover:bg-[#262b29] border border-[#1f332a] transition-colors w-full sm:w-auto cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleStartStream}
              disabled={isStarting}
              type="button"
              className="px-5 py-2 rounded-xl bg-[#4edea3] hover:bg-[#00e296] text-[#003824] font-semibold text-xs transition-all shadow-[0_0_20px_rgba(78,222,163,0.35)] hover:shadow-[0_0_25px_rgba(78,222,163,0.55)] flex items-center justify-center gap-2 w-full sm:w-auto active:scale-95 disabled:opacity-75 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[16px] ${isStarting ? 'animate-spin' : ''}`}>
                {isStarting ? 'sync' : 'sensors'}
              </span>
              <span>{isStarting ? 'Iniciando RTC...' : 'Iniciar Transmissão'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
