import React, { useState, useEffect } from 'react';

interface WebcamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWebcam: (deviceId: string, label: string) => void;
}

export const WebcamModal: React.FC<WebcamModalProps> = ({
  isOpen,
  onClose,
  onSelectWebcam,
}) => {
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([
    { id: 'fhd-cam', label: 'Câmera do PC (FHD Camera Microphone)' },
  ]);
  const [selectedDevice, setSelectedDevice] = useState<string>('fhd-cam');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (isOpen && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(async devs => {
        let videoDevs = devs.filter(d => d.kind === 'videoinput');
        // Se as labels estiverem vazias por política de permissão, desbloqueia nomes reais
        if (videoDevs.length > 0 && !videoDevs[0].label) {
          try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
            tempStream.getTracks().forEach(t => t.stop());
            const refreshed = await navigator.mediaDevices.enumerateDevices();
            videoDevs = refreshed.filter(d => d.kind === 'videoinput');
          } catch {}
        }
        const mapped = videoDevs.map((d, index) => ({
          id: d.deviceId || `cam-${index}`,
          label: d.label || `Câmera Integrada ${index + 1}`,
        }));
        if (mapped.length > 0) {
          setDevices(mapped);
          setSelectedDevice(mapped[0].id);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    setIsRequesting(true);
    const chosen = devices.find(d => d.id === selectedDevice) || devices[0];
    onSelectWebcam(chosen.id, chosen.label);
    setIsRequesting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0f0d]/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#181d1a] border border-[#274237] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden relative flex flex-col p-6 text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#4edea3]/15 border border-[#4edea3]/40 flex items-center justify-center text-[#4edea3] mb-3 mx-auto shadow-[0_0_20px_rgba(78,222,163,0.25)]">
          <span className="material-symbols-outlined text-[28px]">videocam</span>
        </div>

        <h3 className="text-lg font-bold text-[#dfe4e0] mb-1">
          Selecionar Webcam do seu PC
        </h3>
        <p className="text-xs text-[#bbcabf] mb-5">
          Escolha o dispositivo de câmera conectado ao seu computador para ativar o vídeo.
        </p>

        <div className="flex flex-col gap-2 mb-6 text-left">
          <label className="text-xs font-semibold text-[#bbcabf]">Dispositivo de Vídeo:</label>
          <select
            value={selectedDevice}
            onChange={e => setSelectedDevice(e.target.value)}
            className="w-full bg-[#1c211e] border border-[#1f332a] focus:border-[#4edea3] rounded-xl p-3 text-xs text-[#dfe4e0] outline-none"
          >
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-[#1c211e] hover:bg-[#262b29] text-[#bbcabf] font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isRequesting}
            className="flex-1 py-2.5 rounded-xl bg-[#4edea3] hover:bg-[#00e296] text-[#003824] font-bold text-xs transition-all shadow-[0_0_15px_rgba(78,222,163,0.3)] cursor-pointer"
          >
            Ativar Webcam
          </button>
        </div>
      </div>
    </div>
  );
};
