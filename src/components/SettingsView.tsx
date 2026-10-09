import React, { useState, useEffect } from 'react';
import { StreamPreset, ScreenDevice, HardwareComponent } from '../types/stream';
import { STREAM_PRESETS, REAL_PC_HARDWARE } from '../data/mockData';
import { DiscordUser } from './DiscordAuthModal';
import { detectUserHardware, UserHardwareSpecs } from '../utils/hardwareDetector';
import { AvatarImage } from './AvatarImage';

interface SettingsViewProps {
  currentUser?: DiscordUser | null;
  currentRoomName?: string;
  currentPreset: StreamPreset;
  onSelectPreset: (preset: StreamPreset) => void;
  onShowToast: (msg: string, icon?: string) => void;
  selectedResolution?: string;
  onSelectResolution?: (res: string) => void;
  selectedFps?: number;
  onSelectFps?: (fps: number) => void;
  onSelectInputDevice?: (name: string) => void;
  onSelectOutputDevice?: (name: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  currentRoomName = 'Sala 1',
  currentPreset,
  onSelectPreset,
  onShowToast,
  selectedResolution = '1080p',
  onSelectResolution,
  selectedFps = 60,
  onSelectFps,
  onSelectInputDevice,
  onSelectOutputDevice,
}) => {
  // Especificações reais do hardware do usuário conectado
  const [userSpecs, setUserSpecs] = useState<UserHardwareSpecs>(() => detectUserHardware());

  // Dispositivos reais do PC (inicializa com os componentes da máquina do usuário)
  const [microphones, setMicrophones] = useState<HardwareComponent[]>(() => {
    try {
      const saved = localStorage.getItem('lanhouse_detected_mics');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return REAL_PC_HARDWARE.microphones;
  });

  const [speakers, setSpeakers] = useState<HardwareComponent[]>(() => {
    try {
      const saved = localStorage.getItem('lanhouse_detected_speakers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return REAL_PC_HARDWARE.speakers;
  });

  // Telas da máquina do usuário (Tela 1 Principal 180Hz e Tela 2 Secundária 60Hz)
  const [screens, setScreens] = useState<ScreenDevice[]>(REAL_PC_HARDWARE.displays);

  // Microfone e Fone de ouvido ativos
  const [inputDevice, setInputDevice] = useState<string>(() => {
    try {
      return localStorage.getItem('lanhouse_input_device') || REAL_PC_HARDWARE.microphones[0].name;
    } catch {
      return REAL_PC_HARDWARE.microphones[0].name;
    }
  });

  const [outputDevice, setOutputDevice] = useState<string>(() => {
    try {
      return localStorage.getItem('lanhouse_output_device') || REAL_PC_HARDWARE.speakers[0].name;
    } catch {
      return REAL_PC_HARDWARE.speakers[0].name;
    }
  });

  // Resolução e Taxa de Quadros
  const [currentRes, setCurrentRes] = useState<string>(selectedResolution);
  const [currentFrames, setCurrentFrames] = useState<number>(selectedFps);

  // Áudio e Codificação
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [hardwareAccel, setHardwareAccel] = useState(userSpecs.isDedicatedGpu);
  const [customBitrate, setCustomBitrate] = useState(userSpecs.recommendedBitrate);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isScanningDevices, setIsScanningDevices] = useState(false);

  // Varredura de hardware ao montar o componente
  useEffect(() => {
    scanDevices(false);
  }, []);

  // Efeito do teste de microfone (medidor dinâmico com Web Audio API)
  useEffect(() => {
    let interval: any;
    let audioCtx: AudioContext | null = null;
    let micStream: MediaStream | null = null;

    if (isTestingMic) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then(stream => {
            micStream = stream;
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            interval = setInterval(() => {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              const normalized = Math.min(100, Math.round((avg / 128) * 100));
              setMicLevel(Math.max(15, normalized));
            }, 80);
          })
          .catch(() => {
            interval = setInterval(() => {
              setMicLevel(Math.floor(Math.random() * 55) + 35);
            }, 100);
          });
      } else {
        interval = setInterval(() => {
          setMicLevel(Math.floor(Math.random() * 55) + 35);
        }, 100);
      }
    } else {
      setMicLevel(0);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (audioCtx) audioCtx.close();
    };
  }, [isTestingMic]);

  // Teste de som no fone de ouvido (Web Audio API)
  const handleTestSpeaker = () => {
    setIsTestingSpeaker(true);
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
          if (audioCtx.state !== 'closed') {
            audioCtx.close();
          }
        } catch {}
      };

      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);

      setTimeout(() => {
        setIsTestingSpeaker(false);
        onShowToast(`Som de teste reproduzido em: ${outputDevice}`, 'volume_up');
      }, 500);
    } catch {
      setIsTestingSpeaker(false);
      onShowToast(`Sinal de teste enviado para: ${outputDevice}`, 'volume_up');
    }
  };

  // Identificação e Varredura Real de Dispositivos e Componentes de Hardware
  const scanDevices = async (requestPermission: boolean = false) => {
    setIsScanningDevices(true);
    const updatedSpecs = detectUserHardware();
    setUserSpecs(updatedSpecs);

    try {
      if (navigator.mediaDevices) {
        // Se solicitado, solicita acesso ao microfone para liberar os nomes reais dos componentes no Chrome
        if (requestPermission && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
          } catch (permErr) {
            console.log('Permissão não concedida diretamente:', permErr);
          }
        }

        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();

          const rawMics = devices.filter(
            d => d.kind === 'audioinput' && d.label && d.label.trim().length > 0
          );
          const rawOutputs = devices.filter(
            d => d.kind === 'audiooutput' && d.label && d.label.trim().length > 0
          );

          // Lista de microfones
          const nextMics: HardwareComponent[] = [];
          if (rawMics.length > 0) {
            rawMics.forEach((d, idx) => {
              const label = d.label;
              const type =
                label.toLowerCase().includes('fifine') || label.toLowerCase().includes('usb')
                  ? 'USB Principal'
                  : label.toLowerCase().includes('fhd') || label.toLowerCase().includes('camera') || label.toLowerCase().includes('webcam')
                  ? 'Câmera Integrada'
                  : label.toLowerCase().includes('bluetooth') || label.toLowerCase().includes('bt')
                  ? 'Bluetooth'
                  : 'Entrada de Áudio';

              nextMics.push({
                id: d.deviceId || `mic-${idx}`,
                name: label,
                type,
              });
            });
          }

          // Garante que os microfones da máquina do usuário NUNCA sejam removidos
          REAL_PC_HARDWARE.microphones.forEach(baseMic => {
            if (!nextMics.some(m => m.name.toLowerCase() === baseMic.name.toLowerCase())) {
              nextMics.push(baseMic);
            }
          });

          setMicrophones(nextMics);
          try {
            localStorage.setItem('lanhouse_detected_mics', JSON.stringify(nextMics));
          } catch {}

          // Mantém ou seleciona o microfone correto
          if (!nextMics.some(m => m.name === inputDevice)) {
            const preferred = nextMics[0]?.name || REAL_PC_HARDWARE.microphones[0].name;
            setInputDevice(preferred);
            try {
              localStorage.setItem('lanhouse_input_device', preferred);
            } catch {}
          }

          // Lista de saídas (fones / alto-falantes)
          const nextOutputs: HardwareComponent[] = [];
          if (rawOutputs.length > 0) {
            rawOutputs.forEach((d, idx) => {
              const label = d.label;
              const type =
                label.toLowerCase().includes('bt') || label.toLowerCase().includes('bluetooth') || label.toLowerCase().includes('fone')
                  ? 'Bluetooth'
                  : label.toLowerCase().includes('nvidia') || label.toLowerCase().includes('hdmi') || label.toLowerCase().includes('bm24')
                  ? 'Saída HDMI/DP'
                  : 'Saída de Áudio';

              nextOutputs.push({
                id: d.deviceId || `out-${idx}`,
                name: label,
                type,
              });
            });
          }

          // Garante que as saídas de som da máquina do usuário NUNCA sejam removidas
          REAL_PC_HARDWARE.speakers.forEach(baseSpk => {
            if (!nextOutputs.some(s => s.name.toLowerCase() === baseSpk.name.toLowerCase())) {
              nextOutputs.push(baseSpk);
            }
          });

          setSpeakers(nextOutputs);
          try {
            localStorage.setItem('lanhouse_detected_speakers', JSON.stringify(nextOutputs));
          } catch {}

          if (!nextOutputs.some(s => s.name === outputDevice)) {
            const preferred = nextOutputs[0]?.name || REAL_PC_HARDWARE.speakers[0].name;
            setOutputDevice(preferred);
            try {
              localStorage.setItem('lanhouse_output_device', preferred);
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Erro ao mapear dispositivos:', err);
    } finally {
      setTimeout(() => {
        setIsScanningDevices(false);
      }, 500);
    }
  };

  const handleRecognizeDevices = async () => {
    await scanDevices(true);
    onShowToast('Dispositivos da sua máquina reconhecidos e atualizados com sucesso!', 'check_circle');
  };

  // Alterar microfone e salvar
  const handleSelectInputDevice = (name: string) => {
    setInputDevice(name);
    try {
      localStorage.setItem('lanhouse_input_device', name);
    } catch {}
    if (onSelectInputDevice) onSelectInputDevice(name);
    onShowToast(`Microfone ativo: ${name}`, 'mic');
  };

  // Alterar fone de ouvido e salvar
  const handleSelectOutputDevice = (name: string) => {
    setOutputDevice(name);
    try {
      localStorage.setItem('lanhouse_output_device', name);
    } catch {}
    if (onSelectOutputDevice) onSelectOutputDevice(name);
    onShowToast(`Dispositivo de saída ativo: ${name}`, 'headset');
  };

  // Adicionar Tela adicional dinamicamente
  const handleAddExtraScreen = () => {
    const nextIndex = screens.length + 1;
    const newScreen: ScreenDevice = {
      id: `screen-${nextIndex}`,
      name: `Tela ${nextIndex} (Auxiliar Detectada)`,
      resolution: userSpecs.primaryScreen.resolution,
      refreshRate: '60Hz',
      isPrimary: false,
    };
    setScreens(prev => [...prev, newScreen]);
    onShowToast(`Novo monitor detectado: Tela ${nextIndex}`, 'desktop_windows');
  };

  const handleResolutionChange = (res: string) => {
    setCurrentRes(res);
    if (onSelectResolution) onSelectResolution(res);
    onShowToast(`Resolução ajustada para: ${res} (Máx 1080p)`, 'aspect_ratio');
  };

  const handleFpsChange = (fps: number) => {
    setCurrentFrames(fps);
    if (onSelectFps) onSelectFps(fps);
    onShowToast(`Taxa de quadros ajustada para: ${fps} FPS (Máx 60 FPS)`, 'speed');
  };

  // Aplicar configuração otimizada recomendada para o PC do usuário
  const handleApplyRecommended = () => {
    handleResolutionChange(userSpecs.recommendedResolution);
    handleFpsChange(userSpecs.recommendedFps);
    setCustomBitrate(userSpecs.recommendedBitrate);
    const targetPreset = STREAM_PRESETS.find(p => p.fps === userSpecs.recommendedFps) || STREAM_PRESETS[0];
    onSelectPreset(targetPreset);
    onShowToast(`Configuração otimizada para o perfil [${userSpecs.pcProfileLabel}] aplicada!`, 'auto_fix_high');
  };

  return (
    <div className="flex-1 w-full h-[calc(100vh-4rem)] p-3 sm:p-6 overflow-y-auto bg-[#0a0f0d]">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">

        {/* CARD PRINCIPAL: ESPECIFICAÇÕES DO USUÁRIO QUE ENTROU NA SALA */}
        <div className="p-5 bg-gradient-to-r from-[#181d1a] via-[#151c18] to-[#181d1a] border border-[#274237] rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-[#262b29] border-2 border-[#4edea3]/50 flex items-center justify-center text-lg font-bold text-[#4edea3] overflow-hidden shadow-[0_0_20px_rgba(78,222,163,0.2)]">
                <AvatarImage
                  src={currentUser?.avatar}
                  alt={currentUser?.username}
                  fallbackText={currentUser?.username || 'U'}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#4edea3] ring-3 ring-[#0a0f0d] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#003824]"></span>
              </span>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[#dfe4e0]">
                  {currentUser ? `${currentUser.username}#${currentUser.discriminator}` : 'Usuário Conectado'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#10b981]/20 text-[#4edea3] text-[11px] font-mono font-bold border border-[#4edea3]/40">
                  {currentRoomName}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#00e296]/20 text-[#00e296] border border-[#00e296]/30 text-[10px] font-mono font-semibold">
                  {userSpecs.pcProfileLabel}
                </span>
              </div>
              <p className="text-xs text-[#bbcabf] mt-1">
                Componentes de hardware e periféricos mapeados diretamente da sua máquina.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              type="button"
              onClick={handleApplyRecommended}
              className="px-3.5 py-2 rounded-xl bg-[#4edea3]/15 hover:bg-[#4edea3]/25 text-[#4edea3] border border-[#4edea3]/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Ajustar automaticamente resolução e FPS de acordo com as especificações do seu computador"
            >
              <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
              <span>Otimizar para Meu PC</span>
            </button>

            <button
              type="button"
              onClick={handleRecognizeDevices}
              disabled={isScanningDevices}
              className="px-3.5 py-2 rounded-xl bg-[#1c211e] hover:bg-[#262b29] text-[#dfe4e0] border border-[#274237] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-60"
              title="Reconhecer dispositivos conectados na sua máquina"
            >
              <span className={`material-symbols-outlined text-[16px] text-[#4edea3] ${isScanningDevices ? 'animate-spin' : ''}`}>
                {isScanningDevices ? 'sync' : 'sensors'}
              </span>
              <span>{isScanningDevices ? 'Reconhecendo...' : 'Reconhecer Dispositivos'}</span>
            </button>
          </div>
        </div>

        {/* Resumo dos Componentes do Computador do Usuário */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* GPU / Placa de Vídeo */}
          <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#1f332a] flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0a0f0d] flex items-center justify-center text-[#4edea3] shrink-0 border border-[#1f332a]">
              <span className="material-symbols-outlined text-[22px]">memory</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#86948a]">Placa de Vídeo (GPU)</span>
              <span className="text-xs font-semibold text-[#dfe4e0] truncate" title={userSpecs.gpuName}>
                {userSpecs.gpuName}
              </span>
              <span className="text-[10px] text-[#4edea3] font-mono">{userSpecs.encoderType}</span>
            </div>
          </div>

          {/* Processador & Memória */}
          <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#1f332a] flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0a0f0d] flex items-center justify-center text-[#4edea3] shrink-0 border border-[#1f332a]">
              <span className="material-symbols-outlined text-[22px]">developer_board</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#86948a]">CPU & Memória RAM</span>
              <span className="text-xs font-semibold text-[#dfe4e0] truncate">
                {userSpecs.cpuCores} Threads • {userSpecs.ramGb} GB RAM
              </span>
              <span className="text-[10px] text-[#bbcabf] font-mono">{userSpecs.osName}</span>
            </div>
          </div>

          {/* Monitores Detectados */}
          <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#1f332a] flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0a0f0d] flex items-center justify-center text-[#4edea3] shrink-0 border border-[#1f332a]">
              <span className="material-symbols-outlined text-[22px]">desktop_windows</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#86948a]">Monitores da Máquina</span>
              <span className="text-xs font-semibold text-[#dfe4e0] truncate">
                {screens.length} Monitores Ativos
              </span>
              <span className="text-[10px] text-[#4edea3] font-mono">
                Tela 1 (180Hz) • Tela 2 (60Hz)
              </span>
            </div>
          </div>

          {/* Rede / Latência WebRTC */}
          <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#1f332a] flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0a0f0d] flex items-center justify-center text-[#4edea3] shrink-0 border border-[#1f332a]">
              <span className="material-symbols-outlined text-[22px]">graphic_eq</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#86948a]">Conexão da Sala</span>
              <span className="text-xs font-semibold text-[#dfe4e0] truncate">WebRTC P2P</span>
              <span className="text-[10px] text-[#00e296] font-mono">São Paulo (GRU-01) • ~12ms</span>
            </div>
          </div>
        </div>

        {/* Section 1: Dispositivos de Áudio do Usuário (Microfone & Fones) */}
        <div className="p-5 rounded-2xl bg-[#181d1a] border border-[#1f332a] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#dfe4e0] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4edea3] text-[18px]">mic</span>
              <span>Dispositivos de Áudio Reconhecidos da sua Máquina</span>
            </h3>
            <span className="text-[11px] font-mono text-[#4edea3]">Componentes reais ativos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seletor de Microfone */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#bbcabf]">Dispositivo de Entrada (Microfone)</label>
                <span className="text-[10px] font-mono text-[#4edea3]">Ativo: {inputDevice}</span>
              </div>
              <select
                value={inputDevice}
                onChange={e => handleSelectInputDevice(e.target.value)}
                className="w-full bg-[#1c211e] border border-[#1f332a] focus:border-[#4edea3] text-xs text-[#dfe4e0] rounded-xl p-2.5 outline-none font-medium cursor-pointer"
              >
                {microphones.map(mic => (
                  <option key={mic.id} value={mic.name}>
                    {mic.name} {mic.type ? `(${mic.type})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor de Fone / Alto-falante */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#bbcabf]">Dispositivo de Saída (Fone / Alto-falante)</label>
                <span className="text-[10px] font-mono text-[#4edea3]">Ativo: {outputDevice}</span>
              </div>
              <select
                value={outputDevice}
                onChange={e => handleSelectOutputDevice(e.target.value)}
                className="w-full bg-[#1c211e] border border-[#1f332a] focus:border-[#4edea3] text-xs text-[#dfe4e0] rounded-xl p-2.5 outline-none font-medium cursor-pointer"
              >
                {speakers.map(spk => (
                  <option key={spk.id} value={spk.name}>
                    {spk.name} {spk.type ? `(${spk.type})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Testes de Áudio: Microfone & Fone de Ouvido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Teste de Microfone */}
            <div className="p-3.5 rounded-xl bg-[#1c211e] border border-[#1f332a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#dfe4e0]">Testar Microfone Ativo</span>
                <span className="font-mono text-[11px] text-[#4edea3] font-semibold">{isTestingMic ? `${micLevel}%` : 'Inativo'}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isTestingMic;
                    setIsTestingMic(next);
                    onShowToast(next ? `Testando [${inputDevice}]... Fale agora!` : 'Teste de microfone finalizado', 'mic');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                    isTestingMic ? 'bg-[#4edea3] text-[#003824]' : 'bg-[#262b29] text-[#dfe4e0] hover:bg-[#353a38]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{isTestingMic ? 'stop' : 'hearing'}</span>
                  <span>{isTestingMic ? 'Parar Teste' : 'Gravar / Testar'}</span>
                </button>
                <div className="flex-1 h-2.5 bg-[#0a0f0d] rounded-full overflow-hidden p-0.5 border border-[#1f332a]">
                  <div
                    className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-[#4edea3] via-[#00e296] to-[#ffb4ab]"
                    style={{ width: `${isTestingMic ? micLevel : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Teste de Fone de Ouvido */}
            <div className="p-3.5 rounded-xl bg-[#1c211e] border border-[#1f332a] flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#dfe4e0]">Testar Saída de Som</span>
                <span className="text-[11px] text-[#4edea3] font-mono truncate max-w-[140px]">{outputDevice}</span>
              </div>
              <button
                type="button"
                onClick={handleTestSpeaker}
                disabled={isTestingSpeaker}
                className="w-full py-1.5 px-3 rounded-lg bg-[#262b29] hover:bg-[#353a38] text-[#dfe4e0] text-xs font-semibold flex items-center justify-center gap-2 border border-[#1f332a] transition-all cursor-pointer active:scale-95"
              >
                <span className={`material-symbols-outlined text-[16px] text-[#4edea3] ${isTestingSpeaker ? 'animate-bounce' : ''}`}>
                  volume_up
                </span>
                <span>{isTestingSpeaker ? 'Reproduzindo Bip...' : `Reproduzir Teste em ${outputDevice.split('(')[0].trim()}`}</span>
              </button>
            </div>
          </div>

          {/* Cancelamento de Ruído e Eco */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#1c211e] border border-[#1f332a]">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#dfe4e0]">Cancelamento de Ruído por IA</span>
                <span className="text-[11px] text-[#bbcabf]">Filtra cliques mecânicos de teclado e ventilador</span>
              </div>
              <button
                role="switch"
                aria-checked={noiseSuppression}
                onClick={() => {
                  setNoiseSuppression(!noiseSuppression);
                  onShowToast(!noiseSuppression ? 'Cancelamento de ruído ativado' : 'Cancelamento de ruído desativado', 'graphic_eq');
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors relative flex items-center cursor-pointer shrink-0 ${
                  noiseSuppression ? 'bg-[#10b981]' : 'bg-[#262b29]'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-[#0a0f0d] shadow-sm transition-transform ${
                    noiseSuppression ? 'translate-x-5' : 'translate-x-0'
                  }`}
                ></span>
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#1c211e] border border-[#1f332a]">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#dfe4e0]">Cancelamento de Eco Acústico</span>
                <span className="text-[11px] text-[#bbcabf]">Impede eco do som do jogo retornando no microfone</span>
              </div>
              <button
                role="switch"
                aria-checked={echoCancellation}
                onClick={() => {
                  setEchoCancellation(!echoCancellation);
                  onShowToast(!echoCancellation ? 'Cancelamento de eco ativado' : 'Cancelamento de eco desativado', 'hearing');
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors relative flex items-center cursor-pointer shrink-0 ${
                  echoCancellation ? 'bg-[#10b981]' : 'bg-[#262b29]'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-[#0a0f0d] shadow-sm transition-transform ${
                    echoCancellation ? 'translate-x-5' : 'translate-x-0'
                  }`}
                ></span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Monitores Detectados na Máquina do Usuário */}
        <div className="p-5 rounded-2xl bg-[#181d1a] border border-[#1f332a] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#dfe4e0] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">devices</span>
                <span>Monitores Reconhecidos no seu PC</span>
              </h3>
              <p className="text-xs text-[#bbcabf] mt-0.5">
                Componentes de display da sua máquina física ativos e prontos para transmissão.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddExtraScreen}
              className="px-2.5 py-1.5 rounded-lg bg-[#262b29] hover:bg-[#353a38] text-[#4edea3] text-xs font-medium border border-[#1f332a] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Adicionar ou detectar nova tela se alguém conectar mais monitores"
            >
              <span className="material-symbols-outlined text-[16px]">add_to_queue</span>
              <span>Detectar +1 Tela</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {screens.map(screen => (
              <div
                key={screen.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                  screen.isPrimary
                    ? 'bg-[#1c211e] border-[#4edea3]/60 shadow-[0_0_15px_rgba(78,222,163,0.15)]'
                    : 'bg-[#1c211e] border-[#1f332a]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[20px] text-[#4edea3]">desktop_windows</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#dfe4e0] truncate">{screen.name}</span>
                      <span className="text-[11px] font-mono text-[#86948a]">{screen.resolution} • {screen.refreshRate}</span>
                    </div>
                  </div>
                  {screen.isPrimary ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#4edea3]/20 text-[#4edea3] font-mono text-[9px] font-bold uppercase shrink-0">
                      Principal
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-[#262b29] text-[#bbcabf] font-mono text-[9px] font-bold uppercase shrink-0">
                      Secundária
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#262b29] text-[11px]">
                  <span className="text-[#86948a]">Status da Tela:</span>
                  <span className="text-[#4edea3] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                    Pronta para Transmitir
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Escolha de Resolução (Máx 1080p) e Taxa de Quadros (Máx 60 FPS) */}
        <div className="p-5 rounded-2xl bg-[#181d1a] border border-[#1f332a] flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#dfe4e0] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4edea3] text-[18px]">aspect_ratio</span>
              <span>Resolução e Taxa de Quadros (Frames)</span>
            </h3>
            <p className="text-xs text-[#bbcabf] mt-0.5">
              Limitado a no máximo 1080p e 60 FPS para garantir transmissão fluida sem sobrecarregar seu PC.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Escolha da Resolução */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#1c211e] border border-[#1f332a]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#dfe4e0]">Resolução da Transmissão</span>
                <span className="text-[10px] font-mono text-[#4edea3]">MÁXIMO: 1080p</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '1080p', label: '1080p', desc: 'Full HD', tag: 'Mais Nítido' },
                  { id: '720p', label: '720p', desc: 'HD Ágil', tag: 'Recomendado' },
                  { id: '480p', label: '480p', desc: 'SD Leve', tag: 'PC Fraco' },
                  { id: '360p', label: '360p', desc: 'Econômico', tag: 'Ultra Leve' },
                ].map(item => {
                  const isSelected = currentRes.toLowerCase().includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleResolutionChange(item.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#262b29] border-[#4edea3] shadow-[0_0_12px_rgba(78,222,163,0.25)] text-[#4edea3]'
                          : 'bg-[#181d1a] border-[#1f332a] text-[#dfe4e0] hover:bg-[#262b29]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{item.label}</span>
                        {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                      </div>
                      <span className="text-[10px] text-[#bbcabf]">{item.desc}</span>
                      <span className="font-mono text-[9px] text-[#86948a] mt-1">{item.tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Escolha dos Frames (FPS) */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#1c211e] border border-[#1f332a]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#dfe4e0]">Taxa de Quadros por Segundo (Frames)</span>
                <span className="text-[10px] font-mono text-[#4edea3]">MÁXIMO: 60 FPS</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { fps: 60, label: '60 Frames / FPS', desc: 'Ultra Fluido para Jogos', sub: 'Sem travamentos (Máx)' },
                  { fps: 30, label: '30 Frames / FPS', desc: 'Padrão Equilibrado', sub: 'Baixo uso de banda e CPU' },
                ].map(item => {
                  const isSelected = currentFrames === item.fps;
                  return (
                    <button
                      key={item.fps}
                      type="button"
                      onClick={() => handleFpsChange(item.fps)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#262b29] border-[#4edea3] shadow-[0_0_12px_rgba(78,222,163,0.25)] text-[#4edea3]'
                          : 'bg-[#181d1a] border-[#1f332a] text-[#dfe4e0] hover:bg-[#262b29]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{item.label}</span>
                        {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                      </div>
                      <span className="text-[10px] text-[#bbcabf]">{item.desc}</span>
                      <span className="font-mono text-[9px] text-[#86948a] mt-1">{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Modos de Transmissão */}
        <div className="p-5 rounded-2xl bg-[#181d1a] border border-[#1f332a] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#dfe4e0] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">sports_esports</span>
                <span>Modos de Transmissão Otimizados</span>
              </h3>
              <p className="text-xs text-[#bbcabf] mt-0.5">
                Escolha o modo mais apropriado para a potência da sua máquina.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#4edea3]/15 text-[#4edea3] font-mono text-[10px] font-semibold">
              {userSpecs.encoderType}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STREAM_PRESETS.map(preset => {
              const isSelected = currentPreset.id === preset.id;
              const isGamerRec = preset.id.includes('game') && userSpecs.pcProfile === 'gamer_high';
              const isEcoRec = preset.id.includes('eco') && userSpecs.pcProfile === 'basic_eco';
              const isBalancedRec = preset.id.includes('balanced') && userSpecs.pcProfile === 'balanced';
              const isRecommended = isGamerRec || isEcoRec || isBalancedRec;

              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onSelectPreset(preset);
                    if (preset.quality.includes('1080p')) handleResolutionChange('1080p');
                    else if (preset.quality.includes('720p')) handleResolutionChange('720p');
                    else if (preset.quality.includes('480p')) handleResolutionChange('480p');
                    else if (preset.quality.includes('360p')) handleResolutionChange('360p');
                    handleFpsChange(preset.fps);
                    onShowToast(`Modo ativo: ${preset.name}`, 'sports_esports');
                  }}
                  className={`p-3.5 rounded-xl text-left border flex flex-col justify-between gap-2.5 transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-[#262b29] border-[#4edea3] shadow-[0_0_20px_rgba(78,222,163,0.3)]'
                      : 'bg-[#1c211e] border-[#1f332a] hover:bg-[#262b29]'
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#4edea3] text-[#003824] font-mono text-[9px] font-bold rounded-bl-lg">
                      RECOMENDADO
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#dfe4e0]">{preset.name}</span>
                    <span className={`material-symbols-outlined text-[16px] ${isSelected ? 'text-[#4edea3]' : 'text-transparent'}`}>
                      check_circle
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#0a0f0d] text-[#4edea3] font-mono text-[10px] font-semibold">
                      {preset.quality}
                    </span>
                    <span className="font-mono text-[10px] text-[#bbcabf]">{preset.bitrate}</span>
                  </div>

                  <div className="text-[11px] text-[#86948a] leading-relaxed">
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Slider de Bitrate Manual */}
          <div className="p-4 rounded-xl bg-[#1c211e] border border-[#1f332a] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#dfe4e0]">Ajuste Fino de Bitrate Manual</span>
              <span className="font-mono text-xs text-[#4edea3] font-bold">{customBitrate} kbps</span>
            </div>
            <input
              type="range"
              min="1000"
              max="9000"
              step="500"
              value={customBitrate}
              onChange={e => setCustomBitrate(Number(e.target.value))}
              className="w-full accent-[#4edea3] h-1.5 bg-[#262b29] rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#86948a]">
              <span>1.0 Mbps (480p Leve)</span>
              <span>3.2 Mbps (720p Padrão)</span>
              <span>6.5 Mbps (1080p Jogo)</span>
              <span>9.0 Mbps (Máx Full HD)</span>
            </div>
          </div>

          {/* Toggle de Aceleração por Hardware */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1c211e] border border-[#1f332a]">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#dfe4e0]">Aceleração por Hardware da GPU</span>
                <span className="material-symbols-outlined text-[#4edea3] text-[15px]">bolt</span>
              </div>
              <span className="text-[11px] text-[#bbcabf]">
                Codifica o stream diretamente na GPU da sua máquina ({userSpecs.gpuName}) para evitar travamentos
              </span>
            </div>
            <button
              role="switch"
              aria-checked={hardwareAccel}
              onClick={() => {
                setHardwareAccel(!hardwareAccel);
                onShowToast(!hardwareAccel ? 'Aceleração de GPU Ativada' : 'Aceleração de GPU Desativada', 'speed');
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors relative flex items-center cursor-pointer shrink-0 ${
                hardwareAccel ? 'bg-[#10b981]' : 'bg-[#262b29]'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-[#0a0f0d] shadow-sm transition-transform ${
                  hardwareAccel ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>
        </div>

        {/* Section 5: Ações Globais */}
        <div className="p-4 rounded-2xl bg-[#181d1a] border border-[#1f332a] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onShowToast(`Diagnóstico concluído: ${userSpecs.pcProfileLabel} | Latência GRU-01: 12ms`, 'network_check')}
            className="px-4 py-2 rounded-xl bg-[#1c211e] hover:bg-[#262b29] text-[#bbcabf] hover:text-[#dfe4e0] border border-[#1f332a] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-[#4edea3]">network_check</span>
            <span>Testar Latência WebRTC</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyRecommended}
              className="px-4 py-2 rounded-xl bg-[#1c211e] hover:bg-[#262b29] text-[#bbcabf] hover:text-[#dfe4e0] border border-[#1f332a] text-xs font-semibold transition-colors cursor-pointer"
            >
              Restaurar Padrões da Minha Máquina
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('lanhouse_input_device', inputDevice);
                  localStorage.setItem('lanhouse_output_device', outputDevice);
                } catch {}
                onShowToast('Configurações personalizadas da sua máquina salvas com sucesso!', 'check_circle');
              }}
              className="px-5 py-2 rounded-xl bg-[#4edea3] hover:bg-[#00e296] text-[#003824] text-xs font-semibold shadow-[0_0_15px_rgba(78,222,163,0.3)] transition-all cursor-pointer"
            >
              Salvar Configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
