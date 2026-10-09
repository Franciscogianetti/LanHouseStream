/**
 * Detector de Atividade de Voz em Tempo Real (Web Audio API)
 * Otimizado para consumir o mínimo de memória RAM e CPU:
 * - Ciclo intervalado leve de 50ms (20hz) em vez de requestAnimationFrame contínuo a 144Hz/240Hz
 * - fftSize reduzido para 128 para diminuir alocação de Float32Array e cálculos
 * - Desconexão e liberação imediata de nós de áudio e threads de hardware no stop()
 */
export class VoiceDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private intervalId: any = null;
  private onSpeakingChange: (isSpeaking: boolean) => void;
  private isSpeaking = false;
  private silenceTimer: number | null = null;
  private threshold = 0.025; // Sensibilidade de fala
  private buffer: Float32Array | null = null;

  private isOwnStream = false;

  constructor(onSpeakingChange: (isSpeaking: boolean) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  async start(existingStream?: MediaStream | null) {
    if (this.stream) return;
    try {
      if (existingStream) {
        this.stream = existingStream;
        this.isOwnStream = false;
      } else {
        if (!navigator.mediaDevices?.getUserMedia) return;
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.isOwnStream = true;
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.3;

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      this.buffer = new Float32Array(this.analyser.fftSize);

      // Intervalo eficiente de 60ms para economizar CPU e estabilizar detecção
      this.intervalId = setInterval(() => {
        if (!this.analyser || !this.buffer) return;
        (this.analyser as any).getFloatTimeDomainData(this.buffer);
        let sum = 0;
        const len = this.buffer.length;
        for (let i = 0; i < len; i++) {
          sum += this.buffer[i] * this.buffer[i];
        }
        const rms = Math.sqrt(sum / len);

        if (rms > this.threshold) {
          if (!this.isSpeaking) {
            this.isSpeaking = true;
            this.onSpeakingChange(true);
          }
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        } else if (this.isSpeaking && !this.silenceTimer) {
          this.silenceTimer = window.setTimeout(() => {
            this.isSpeaking = false;
            this.onSpeakingChange(false);
            this.silenceTimer = null;
          }, 450);
        }
      }, 60);
    } catch {
      // Ignora se o microfone não foi autorizado ainda pelo usuário
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }
    if (this.stream && this.isOwnStream) {
      this.stream.getTracks().forEach(t => t.stop());
    }
    this.stream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.buffer = null;
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange(false);
    }
  }
}
