// Utilitário de Efeitos Sonoros em Tempo Real via Web Audio API
// Otimizado para consumir o mínimo de RAM e liberar threads de áudio do sistema

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private idleTimer: any = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    // Libera a thread do AudioContext suspendendo o contexto após 2 segundos de inatividade
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.idleTimer = setTimeout(() => {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    }, 2000);

    return this.ctx;
  }

  // Bip de Entrada / Saudação (Acorde ascendente harmonioso C5 -> E5 -> G5)
  playUserJoinSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99]; // Dó, Mi, Sol
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.18, now + index * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Desconecta e libera da memória RAM assim que a nota terminar
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.4);
      });
    } catch {
      // Ignora erro se áudio não for permitido antes do gesto do usuário
    }
  }

  // Bip de Despedida / Saída (Tom descendente suave G5 -> D5 -> C5)
  playUserLeaveSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const notes = [783.99, 587.33, 440.0]; // Sol, Ré, Lá
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.09);

        gain.gain.setValueAtTime(0, now + index * 0.09);
        gain.gain.linearRampToValueAtTime(0.15, now + index * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.09 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Desconecta e libera da memória RAM assim que a nota terminar
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };

        osc.start(now + index * 0.09);
        osc.stop(now + index * 0.09 + 0.35);
      });
    } catch {
      // Ignora erro
    }
  }
}

export const soundEffects = new SoundEffectsManager();
