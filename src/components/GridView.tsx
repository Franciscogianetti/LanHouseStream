import React, { useState } from 'react';
import { Participant, StreamSource } from '../types/stream';
import { APP_ASSETS } from '../data/mockData';

interface GridViewProps {
  currentSource: StreamSource;
  isStreaming: boolean;
  participants: Participant[];
  onOpenSourceModal: () => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export const GridView: React.FC<GridViewProps> = ({
  currentSource,
  isStreaming,
  participants,
  onOpenSourceModal,
  onShowToast,
}) => {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<{ [id: string]: number }>({
    gabriel: 100,
    devin: 90,
    sarah: 100,
    lucas: 80,
  });

  const handleVolumeChange = (id: string, val: number) => {
    setVolumes(prev => ({ ...prev, [id]: val }));
  };

  return (
    <div className="flex-1 w-full h-[calc(100vh-4rem)] p-3 sm:p-6 overflow-y-auto bg-[#0a0f0d]">
      <div className="max-w-7xl mx-auto flex flex-col gap-4 h-full">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#181d1a] border border-[#1f332a] rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#262b29] flex items-center justify-center text-[#4edea3]">
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#dfe4e0]">Visão em Grade da Call</h2>
              <p className="text-xs text-[#bbcabf]">
                {participants.length} participantes conectados • Modo sincronizado WebRTC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSourceModal}
              className="px-3.5 py-1.5 rounded-xl bg-[#1c211e] hover:bg-[#262b29] text-[#dfe4e0] border border-[#1f332a] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-[#4edea3]">screen_share</span>
              <span>{isStreaming ? 'Trocar Tela Compartilhada' : 'Compartilhar Tela'}</span>
            </button>
            {pinnedId && (
              <button
                onClick={() => {
                  setPinnedId(null);
                  onShowToast('Foco liberado para grade equilibrada', 'grid_view');
                }}
                className="px-3 py-1.5 rounded-xl bg-[#262b29] text-[#4edea3] text-xs font-semibold hover:bg-[#353a38] transition-colors"
                type="button"
              >
                Resetar Foco
              </button>
            )}
          </div>
        </div>

        {/* 2x2 Grid or Pinned Layout */}
        <div className={`grid gap-4 flex-1 min-h-[500px] ${
          pinnedId ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
        }`}>
          {/* Tile 1: Screen Share Feed */}
          <div className={`relative rounded-2xl bg-[#181d1a] border overflow-hidden flex flex-col justify-between group transition-all ${
            pinnedId === 'screen'
              ? 'lg:col-span-2 border-[#4edea3] shadow-[0_0_25px_rgba(78,222,163,0.2)]'
              : 'border-[#1f332a] hover:border-[#274237]'
          }`}>
            <div className="absolute inset-0 bg-[#0a0f0d]">
              <img
                src={currentSource.image}
                alt="Shared Screen"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f0d]/80 via-transparent to-[#0a0f0d]/40 pointer-events-none"></div>
            </div>

            {/* Top Badge */}
            <div className="relative z-10 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0a0f0d]/85 backdrop-blur-md border border-[#1f332a] text-xs">
                <span className="w-2 h-2 rounded-full bg-[#00ffaa] animate-pulse"></span>
                <span className="font-semibold text-[#dfe4e0]">Transmissão de Tela: {currentSource.name}</span>
              </div>
              <button
                onClick={() => {
                  setPinnedId(pinnedId === 'screen' ? null : 'screen');
                  onShowToast(pinnedId === 'screen' ? 'Desafixado' : 'Tela fixada em destaque', 'push_pin');
                }}
                className="p-1.5 rounded-lg bg-[#0a0f0d]/80 text-[#bbcabf] hover:text-[#4edea3] transition-colors"
                title="Fixar em destaque"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">push_pin</span>
              </button>
            </div>

            {/* Bottom Controls */}
            <div className="relative z-10 p-3 flex items-center justify-between bg-[#0a0f0d]/80 backdrop-blur-md border-t border-[#1f332a]">
              <span className="font-mono text-xs text-[#4edea3]">1080p 60 FPS • 8.4 Mbps</span>
              <span className="font-mono text-xs text-[#00e296]">Áudio do Sistema Ativo (100%)</span>
            </div>
          </div>

          {/* Tile 2: Gabriel (Host) Camera */}
          <div className={`relative rounded-2xl bg-[#181d1a] border overflow-hidden flex flex-col justify-between group transition-all ${
            pinnedId === 'gabriel'
              ? 'lg:col-span-2 border-[#4edea3] shadow-[0_0_25px_rgba(78,222,163,0.2)]'
              : 'border-[#1f332a] hover:border-[#274237]'
          }`}>
            <div className="absolute inset-0 bg-[#0a0f0d]">
              <img
                src={APP_ASSETS.hostCamera}
                alt="Apresentador"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f0d]/80 via-transparent to-transparent pointer-events-none"></div>
            </div>

            <div className="relative z-10 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0a0f0d]/85 backdrop-blur-md border border-[#1f332a] text-xs">
                <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
                <span className="font-semibold text-[#dfe4e0]">Apresentador (Você)</span>
              </div>
              <button
                onClick={() => setPinnedId(pinnedId === 'gabriel' ? null : 'gabriel')}
                className="p-1.5 rounded-lg bg-[#0a0f0d]/80 text-[#bbcabf] hover:text-[#4edea3] transition-colors"
                title="Fixar em destaque"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">push_pin</span>
              </button>
            </div>

            <div className="relative z-10 p-3 flex items-center justify-between bg-[#0a0f0d]/80 backdrop-blur-md border-t border-[#1f332a]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#4edea3]">volume_up</span>
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={volumes.gabriel}
                  onChange={e => handleVolumeChange('gabriel', Number(e.target.value))}
                  className="w-24 accent-[#4edea3] h-1.5 bg-[#262b29] rounded-lg cursor-pointer"
                />
                <span className="font-mono text-[10px] text-[#4edea3]">{volumes.gabriel}%</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-[#4edea3]">mic</span>
            </div>
          </div>

          {/* Tile 3: Sarah.K Camera */}
          <div className={`relative rounded-2xl bg-[#181d1a] border overflow-hidden flex flex-col justify-between group transition-all ${
            pinnedId === 'sarah'
              ? 'lg:col-span-2 border-[#4edea3] shadow-[0_0_25px_rgba(78,222,163,0.2)]'
              : 'border-[#1f332a] hover:border-[#274237]'
          }`}>
            <div className="absolute inset-0 bg-[#0a0f0d]">
              <img
                src={APP_ASSETS.sarahCamera}
                alt="Sarah"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f0d]/80 via-transparent to-transparent pointer-events-none"></div>
            </div>

            <div className="relative z-10 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0a0f0d]/85 backdrop-blur-md border border-[#1f332a] text-xs">
                <span className="w-2 h-2 rounded-full bg-[#00e296]"></span>
                <span className="font-semibold text-[#dfe4e0]">Sarah.K</span>
              </div>
              <button
                onClick={() => setPinnedId(pinnedId === 'sarah' ? null : 'sarah')}
                className="p-1.5 rounded-lg bg-[#0a0f0d]/80 text-[#bbcabf] hover:text-[#4edea3] transition-colors"
                title="Fixar em destaque"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">push_pin</span>
              </button>
            </div>

            <div className="relative z-10 p-3 flex items-center justify-between bg-[#0a0f0d]/80 backdrop-blur-md border-t border-[#1f332a]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#4edea3]">volume_up</span>
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={volumes.sarah}
                  onChange={e => handleVolumeChange('sarah', Number(e.target.value))}
                  className="w-24 accent-[#4edea3] h-1.5 bg-[#262b29] rounded-lg cursor-pointer"
                />
                <span className="font-mono text-[10px] text-[#4edea3]">{volumes.sarah}%</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-[#4edea3]">mic</span>
            </div>
          </div>

          {/* Tile 4: Devin_R & Lucas M. Split Audio Cards */}
          <div className="rounded-2xl bg-[#181d1a] border border-[#1f332a] p-4 flex flex-col justify-between gap-3">
            {/* Devin Card */}
            <div className="p-3 rounded-xl bg-[#1c211e] border border-[#274237] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#262b29] border border-[#4edea3]/40 flex items-center justify-center font-bold text-[#4edea3] text-sm">
                  DR
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#dfe4e0]">Devin_R</div>
                  <div className="font-mono text-[10px] text-[#00e296]">Microfone Ativo</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={volumes.devin}
                  onChange={e => handleVolumeChange('devin', Number(e.target.value))}
                  className="w-20 accent-[#4edea3] h-1 bg-[#262b29] rounded-lg"
                />
                <span className="material-symbols-outlined text-[16px] text-[#bbcabf]">mic</span>
              </div>
            </div>

            {/* Lucas Card */}
            <div className="p-3 rounded-xl bg-[#1c211e] border border-[#1f332a] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#262b29] border border-[#86948a]/40 flex items-center justify-center font-bold text-[#86948a] text-sm">
                  LM
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#86948a]">Lucas M.</div>
                  <div className="font-mono text-[10px] text-[#ffb4ab]">Microfone Silenciado</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={volumes.lucas}
                  onChange={e => handleVolumeChange('lucas', Number(e.target.value))}
                  className="w-20 accent-[#4edea3] h-1 bg-[#262b29] rounded-lg"
                />
                <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">mic_off</span>
              </div>
            </div>

            {/* Voice Room Status */}
            <div className="p-3 rounded-xl bg-[#0a0f0d] border border-[#1f332a] flex items-center justify-between text-xs font-mono">
              <span className="text-[#86948a]">Áudio Espacial:</span>
              <span className="text-[#4edea3]">Estéreo 48kHz / Ativo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
