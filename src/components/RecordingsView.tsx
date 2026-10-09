import React, { useState } from 'react';
import { Recording } from '../types/stream';
import { RECORDINGS_DATA } from '../data/mockData';

interface RecordingsViewProps {
  onShowToast: (msg: string, icon?: string) => void;
}

export const RecordingsView: React.FC<RecordingsViewProps> = ({ onShowToast }) => {
  const [recordings, setRecordings] = useState<Recording[]>(RECORDINGS_DATA);
  const [playingRecording, setPlayingRecording] = useState<Recording | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPlayerMuted, setIsPlayerMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  React.useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleToggleRecord = () => {
    if (!isRecording) {
      setIsRecording(true);
      onShowToast('Gravação do Stage iniciada!', 'fiber_manual_record');
    } else {
      setIsRecording(false);
      const mins = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
      const secs = String(recordSeconds % 60).padStart(2, '0');
      const durStr = recordSeconds === 0 ? '00:15' : `${mins}:${secs}`;
      const newRec: Recording = {
        id: 'rec-' + Date.now(),
        title: `Gravação Lan House Stream #${recordings.length + 1}`,
        duration: durStr,
        resolution: '1920 x 1080',
        fps: '60 FPS',
        date: 'Hoje',
        fileSize: `${Math.max(14, Math.round(recordSeconds * 2.8))} MB`,
        thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPGRmAp5cb-Mj3FiQqIP-tIGr0SByIFnogrTJa6biF-hIK1olnvMDUYqh2ThqEWYTszVBpCa-IkYh4eY0APNBFBQ4yljscQN1tRn4e4F5xQlYB5i5MLb4_T2XANVzzFAyqEyWFnp36wOc5xTQIwOUtnNWoz597FYybDiLoaqsv4hGhvY_6tD9jOJ5EN9hW--C_UHLOGTrsdN56jPg08pmLIorYBYpNNtNu66VB_13EVEXE68RNJidZ',
        codec: 'AV1 (NVENC) 60FPS',
      };
      setRecordings(prev => [newRec, ...prev]);
      onShowToast('Gravação concluída e adicionada à lista!', 'check_circle');
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecordings(prev => prev.filter(r => r.id !== id));
    onShowToast('Gravação removida do armazenamento local', 'delete');
  };

  return (
    <div className="flex-1 w-full h-[calc(100vh-4rem)] p-3 sm:p-6 overflow-y-auto bg-[#0a0f0d]">
      <div className="max-w-6xl mx-auto flex flex-col gap-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#181d1a] border border-[#1f332a] rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#262b29] flex items-center justify-center text-[#4edea3]">
              <span className="material-symbols-outlined text-[22px]">video_library</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#dfe4e0]">Gravações de Transmissões</h2>
              <p className="text-xs text-[#bbcabf]">
                Armazenamento de transmissões da Lan House e replays contínuos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleRecord}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                isRecording
                  ? 'bg-[#ffb4ab] text-[#003824] shadow-[0_0_20px_rgba(255,180,171,0.5)]'
                  : 'bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 text-[#ffb4ab] border border-[#ffb4ab]/30'
              }`}
              type="button"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-[#ff5555] animate-ping' : 'bg-[#ffb4ab] animate-pulse'}`}></span>
              <span>
                {isRecording
                  ? `Parar Gravação (${String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:${String(recordSeconds % 60).padStart(2, '0')})`
                  : 'Gravar Stage Atual'}
              </span>
            </button>
          </div>
        </div>

        {/* Recordings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recordings.map(rec => (
            <div
              key={rec.id}
              onClick={() => setPlayingRecording(rec)}
              className="group cursor-pointer rounded-2xl bg-[#181d1a] border border-[#1f332a] hover:border-[#4edea3]/50 p-3.5 flex flex-col justify-between transition-all hover:shadow-[0_10px_25px_rgba(0,0,0,0.6)]"
            >
              {/* Thumbnail with overlay duration */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0a0f0d] mb-3">
                <img
                  src={rec.thumbnail}
                  alt={rec.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-[#0a0f0d]/40 group-hover:bg-transparent transition-colors flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#0a0f0d]/80 text-[#4edea3] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">play_arrow</span>
                  </div>
                </div>

                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#0a0f0d]/90 text-[#dfe4e0] font-mono text-[10px] font-semibold">
                  {rec.duration}
                </div>

                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#0a0f0d]/85 text-[#4edea3] font-mono text-[10px]">
                  {rec.resolution}
                </div>
              </div>

              {/* Title & metadata */}
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold text-[#dfe4e0] line-clamp-1 group-hover:text-[#4edea3] transition-colors">
                  {rec.title}
                </h3>
                <div className="flex items-center justify-between text-[11px] font-mono text-[#bbcabf]">
                  <span>{rec.date}</span>
                  <span className="text-[#00e296]">{rec.fileSize}</span>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#1f332a] text-xs">
                <span className="text-[10px] font-mono text-[#86948a]">{rec.codec}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onShowToast(`Download iniciado: ${rec.title}.mkv`, 'download');
                    }}
                    className="p-1.5 rounded-lg text-[#bbcabf] hover:text-[#4edea3] hover:bg-[#262b29] transition-colors"
                    title="Baixar arquivo de vídeo"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                  </button>
                  <button
                    onClick={e => handleDelete(rec.id, e)}
                    className="p-1.5 rounded-lg text-[#bbcabf] hover:text-[#ffb4ab] hover:bg-[#262b29] transition-colors"
                    title="Excluir gravação"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Video Player Modal */}
        {playingRecording && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0f0d]/90 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-4xl bg-[#181d1a] border border-[#274237] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-4 flex items-center justify-between border-b border-[#1f332a]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4edea3] text-[20px]">smart_display</span>
                  <span className="text-sm font-semibold text-[#dfe4e0]">{playingRecording.title}</span>
                </div>
                <button
                  onClick={() => setPlayingRecording(null)}
                  className="p-1.5 rounded-lg text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#262b29]"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Player canvas */}
              <div className="relative w-full aspect-video bg-[#0a0f0d] flex items-center justify-center">
                <img
                  src={playingRecording.thumbnail}
                  alt={playingRecording.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-16 h-16 rounded-full bg-[#0a0f0d]/80 hover:bg-[#10b981] hover:text-[#003824] text-[#4edea3] flex items-center justify-center transition-all shadow-xl"
                >
                  <span className="material-symbols-outlined text-[32px]">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                {/* Scrim control bar */}
                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-[#0a0f0d] via-[#0a0f0d]/80 to-transparent flex items-center justify-between text-xs font-mono text-[#bbcabf]">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-1.5 rounded-lg bg-[#262b29] text-[#4edea3] hover:bg-[#353a38] transition-colors"
                      title={isPlaying ? 'Pausar' : 'Reproduzir'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                    <button
                      onClick={() => setIsPlayerMuted(!isPlayerMuted)}
                      className="p-1.5 rounded-lg bg-[#262b29] text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#353a38] transition-colors"
                      title={isPlayerMuted ? 'Ativar Som' : 'Silenciar'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isPlayerMuted ? 'volume_off' : 'volume_up'}
                      </span>
                    </button>
                    <span>00:14:32 / {playingRecording.duration}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#4edea3]">{playingRecording.resolution}</span>
                    <span className="text-[#00e296]">{playingRecording.codec}</span>
                    <button
                      onClick={() => onShowToast('Vídeo expandido em tela cheia', 'fullscreen')}
                      className="p-1 rounded text-[#bbcabf] hover:text-[#4edea3]"
                      title="Tela Cheia"
                    >
                      <span className="material-symbols-outlined text-[18px]">fullscreen</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
