/**
 * Gerenciador WebRTC de Alta Performance estilo GoLive / Discord
 * Separação completa de canais:
 * 1. Canal de Voz: RTCPeerConnection dedicado para áudio de microfone
 * 2. Canal de Transmissão de Tela (GoLive): RTCPeerConnections dedicadas exclusivamente para vídeo/áudio de tela
 * Zero colisões, zero travamentos de renegociação, funciona em qualquer rede, PC e navegador.
 */

import { lanSyncClient } from './lanSyncClient';

export class WebRtcMeshManager {
  // Transmissão de Tela local e remota (GoLive Multi-Stream com Negociação Perfeita)
  private localStream: MediaStream | null = null;
  private screenConnections: Map<string, RTCPeerConnection> = new Map(); // peerId -> RTCPeerConnection
  private makingOfferMap: Map<string, boolean> = new Map();
  private pendingScreenCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map(); // streamerId -> MediaStream
  private registeredVideoElements = new Map<string, HTMLVideoElement>();

  // Comunicação por Voz (Áudio Mesh)
  private voiceStream: MediaStream | null = null;
  private voicePeerConnections: Map<string, RTCPeerConnection> = new Map(); // targetId -> pc
  private pendingVoiceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private mutedRemoteUsers: Set<string> = new Set();
  private isDeafened: boolean = false;
  private isVoiceMuted: boolean = false;

  private onRemoteStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private currentUserId: string = '';
  private currentRoomId: string = '';
  private unsubSignal: (() => void) | null = null;

  // Servidores STUN e TURN de alta disponibilidade para conexões em qualquer operadora/roteador/CGNAT
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:openrelay.metered.ca:80' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
    iceCandidatePoolSize: 10,
  };

  init(userId: string, roomId: string, onRemoteStream: (participantId: string, stream: MediaStream) => void) {
    if (this.unsubSignal) {
      this.unsubSignal();
      this.unsubSignal = null;
    }

    this.currentUserId = userId;
    this.currentRoomId = roomId;
    this.onRemoteStreamCallback = onRemoteStream;

    // Escuta sinais WebRTC recebidos do servidor de sincronização
    this.unsubSignal = lanSyncClient.on('WEBRTC_SIGNAL', async (data: any) => {
      const { fromUserId, signal } = data;
      if (!fromUserId || !signal || fromUserId === this.currentUserId) return;

      try {
        switch (signal.type) {
          // --- Sinais da Transmissão de Tela (GoLive) ---
          case 'STREAM_OFFER':
            await this.handleStreamOffer(fromUserId, signal.offer);
            break;
          case 'STREAM_ANSWER':
            await this.handleStreamAnswer(fromUserId, signal.answer);
            break;
          case 'STREAM_CANDIDATE':
            await this.handleStreamCandidate(fromUserId, signal.candidate);
            break;
          case 'REQUEST_STREAM':
            if (this.localStream) {
              await this.sendScreenOffer(fromUserId);
            }
            break;

          // --- Sinais do Chat de Voz (Áudio) ---
          case 'VOICE_OFFER':
          case 'OFFER':
            await this.handleVoiceOffer(fromUserId, signal.offer);
            break;
          case 'VOICE_ANSWER':
          case 'ANSWER':
            await this.handleVoiceAnswer(fromUserId, signal.answer);
            break;
          case 'VOICE_CANDIDATE':
          case 'CANDIDATE':
            await this.handleVoiceCandidate(fromUserId, signal.candidate);
            break;

          default:
            break;
        }
      } catch (err) {
        console.warn('[WebRTC] Erro no processamento de sinal:', err);
      }
    });
  }

  // =========================================================================
  // CANAL DE TRANSMISSÃO DE TELA (GoLive WebRTC) - TOTALMENTE ISOLADO
  // =========================================================================

  /**
   * Obtém ou inicializa a conexão WebRTC dedicada para um par, com negociação perfeita
   */
  private getOrCreateScreenConnection(peerId: string): RTCPeerConnection {
    let pc = this.screenConnections.get(peerId);
    if (pc && pc.signalingState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection(this.rtcConfig);
    this.screenConnections.set(peerId, pc);

    // 2. Trata o evento onnegotiationneeded para renegociar a conexão automaticamente
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOfferMap.set(peerId, true);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        lanSyncClient.sendWebRtcSignal(peerId, {
          type: 'STREAM_OFFER',
          offer: pc.localDescription,
        });
      } catch (err) {
        console.error('Erro na renegociação:', err);
      } finally {
        this.makingOfferMap.set(peerId, false);
      }
    };

    // Envia candidatos ICE para o par remoto
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        lanSyncClient.sendWebRtcSignal(peerId, {
          type: 'STREAM_CANDIDATE',
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      }
    };

    // No receptor ('ontrack'), gerencia múltiplos fluxos sem sobrescrever o vídeo já em exibição
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const stream = remoteStream || (event.track ? new MediaStream([event.track]) : null);
      if (stream) {
        this.remoteStreams.set(peerId, stream);

        // Vincula diretamente ao elemento <video> do usuário correspondente
        const videoEl = this.registeredVideoElements.get(peerId);
        if (videoEl && remoteStream) {
          if (videoEl.srcObject !== remoteStream) {
            videoEl.srcObject = remoteStream;
          }
          videoEl.play().catch((err) => console.warn('Erro ao reproduzir vídeo:', err));
        }

        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(peerId, stream);
        }
      }
    };

    return pc;
  }

  /**
   * Vincula diretamente o elemento <video> do leitor recetor para anexação instantânea no ontrack
   */
  registerVideoElement(peerId: string, el: HTMLVideoElement | null) {
    if (el) {
      this.registeredVideoElements.set(peerId, el);
      const stream = this.remoteStreams.get(peerId);
      if (stream) {
        if (el.srcObject !== stream) {
          el.srcObject = stream;
        }
        el.play().catch((err) => console.warn('Erro ao reproduzir vídeo:', err));
      }
    } else {
      this.registeredVideoElements.delete(peerId);
    }
  }

  unregisterVideoElement(peerId: string) {
    this.registeredVideoElements.delete(peerId);
  }

  /**
   * Inicia transmissão de tela local criando ou atualizando conexões para cada participante
   */
  async startBroadcast(stream: MediaStream, otherUserIds: string[]) {
    this.localStream = stream;

    for (const viewerId of otherUserIds) {
      if (viewerId && viewerId !== this.currentUserId) {
        await this.addStreamToPeer(viewerId, stream);
      }
    }
  }

  /**
   * Adiciona ou substitui faixas do stream no par especificado
   */
  async addStreamToPeer(peerId: string, stream: MediaStream) {
    if (!peerId || peerId === this.currentUserId) return;
    const pc = this.getOrCreateScreenConnection(peerId);

    const currentSenders = pc.getSenders();
    stream.getTracks().forEach((track) => {
      const existingSender = currentSenders.find(s => s.track && s.track.kind === track.kind);
      if (existingSender) {
        existingSender.replaceTrack(track).catch(() => {});
      } else {
        pc.addTrack(track, stream);
      }
    });

    if (pc.signalingState === 'stable') {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        lanSyncClient.sendWebRtcSignal(peerId, {
          type: 'STREAM_OFFER',
          offer: pc.localDescription,
        });
      } catch (err) {
        console.warn(`[WebRTC] Erro ao enviar oferta para ${peerId}:`, err);
      }
    }
  }

  /**
   * Envia oferta de transmissão de tela dedicada para um espectador específico
   */
  async sendScreenOffer(viewerId: string) {
    if (!this.localStream || !viewerId || viewerId === this.currentUserId) return;
    await this.addStreamToPeer(viewerId, this.localStream);
  }

  /**
   * Espectador recebe a oferta com tratamento de colisão (Perfect Negotiation / Glare handling)
   */
  private async handleStreamOffer(fromUserId: string, offer: RTCSessionDescriptionInit) {
    try {
      const pc = this.getOrCreateScreenConnection(fromUserId);
      const isPolite = this.currentUserId < fromUserId;
      const isMakingOffer = this.makingOfferMap.get(fromUserId) || false;

      // Colisão de ofertas (ambos transmitindo simultaneamente)
      const offerCollision = (offer.type === 'offer') &&
        (isMakingOffer || pc.signalingState !== 'stable');

      if (offerCollision && !isPolite) {
        console.log(`[WebRTC] Colisão detectada com ${fromUserId}: impolite ignorando oferta concorrente`);
        return;
      }

      if (offerCollision && isPolite) {
        console.log(`[WebRTC] Colisão detectada com ${fromUserId}: polite fazendo rollback para aceitar oferta`);
        await pc.setRemoteDescription({ type: 'rollback' });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Despeja candidatos ICE pendentes no recetor
      const pending = this.pendingScreenCandidates.get(fromUserId);
      if (pending && pending.length > 0) {
        for (const cand of pending) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (err) {
            console.warn('[WebRTC] Erro ao aplicar candidato ICE no recetor:', err);
          }
        }
        this.pendingScreenCandidates.delete(fromUserId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      lanSyncClient.sendWebRtcSignal(fromUserId, {
        type: 'STREAM_ANSWER',
        answer: pc.localDescription,
      });
    } catch (err) {
      console.warn(`[WebRTC] Erro ao processar oferta de tela de ${fromUserId}:`, err);
    }
  }

  /**
   * Transmissor recebe a resposta do espectador
   */
  private async handleStreamAnswer(fromUserId: string, answer: RTCSessionDescriptionInit) {
    try {
      const pc = this.screenConnections.get(fromUserId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        // Despeja candidatos ICE pendentes no transmissor
        const pending = this.pendingScreenCandidates.get(fromUserId);
        if (pending && pending.length > 0) {
          for (const cand of pending) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (err) {
              console.warn('[WebRTC] Erro ao aplicar candidato ICE no transmissor:', err);
            }
          }
          this.pendingScreenCandidates.delete(fromUserId);
        }
      }
    } catch (err) {
      console.warn(`[WebRTC] Erro ao aplicar resposta de tela de ${fromUserId}:`, err);
    }
  }

  /**
   * Processa candidato ICE da transmissão de tela em ambas as pontas
   */
  private async handleStreamCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    try {
      if (!candidate || !candidate.candidate) return;
      const pc = this.screenConnections.get(peerId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (err) {
          console.warn('[WebRTC] Erro ao adicionar candidato ICE imediato:', err);
        }
      } else {
        const queue = this.pendingScreenCandidates.get(peerId) || [];
        queue.push(candidate);
        this.pendingScreenCandidates.set(peerId, queue);
      }
    } catch {}
  }

  /**
   * 1. Troca Dinâmica de Resolução (Sem derrubar a conexão):
   * Aplica constraints diretamente na faixa de vídeo ativa sem interromper o fluxo
   */
  async applyVideoConstraints(targetWidth: number, targetHeight: number, targetFps: number) {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack && videoTrack.applyConstraints) {
        try {
          await videoTrack.applyConstraints({
            width: { ideal: targetWidth },
            height: { ideal: targetHeight },
            frameRate: { ideal: targetFps },
          });
          console.log(`[WebRTC] Constraints aplicadas com sucesso na faixa ativa: ${targetWidth}x${targetHeight} @ ${targetFps}FPS`);
        } catch (err) {
          console.warn('[WebRTC] Falha ao aplicar constraints no track ativo:', err);
        }
      }
    }
  }

  /**
   * Caso crie um novo MediaStream ao mudar a qualidade, faz a troca usando replaceTrack()
   */
  async replaceVideoTrack(newVideoTrack: MediaStreamTrack) {
    for (const pc of this.screenConnections.values()) {
      if (pc.signalingState !== 'closed') {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          try {
            await sender.replaceTrack(newVideoTrack);
            console.log('[WebRTC] replaceTrack executado com sucesso no sender de vídeo');
          } catch (err) {
            console.warn('[WebRTC] Erro no replaceTrack:', err);
          }
        }
      }
    }
  }

  /**
   * Solicita transmissão ativa para um transmissor
   */
  requestStreamFrom(streamerUserId: string) {
    if (streamerUserId && streamerUserId !== this.currentUserId) {
      lanSyncClient.sendWebRtcSignal(streamerUserId, {
        type: 'REQUEST_STREAM',
      });
    }
  }

  /**
   * Conecta com novo participante que acabou de entrar na sala
   */
  connectToNewPeer(participantId: string) {
    if (this.localStream) {
      this.addStreamToPeer(participantId, this.localStream);
    }
    this.connectToRoomPeers([participantId]);
  }

  /**
   * Interrompe o compartilhamento de tela local
   */
  stopBroadcast() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      this.localStream = null;
    }

    // Remove as faixas de tela de todos os senders ativos sem encerrar as conexões
    this.screenConnections.forEach(pc => {
      if (pc.signalingState !== 'closed') {
        pc.getSenders().forEach(sender => {
          if (sender.track) {
            try {
              sender.track.stop();
              pc.removeTrack(sender);
            } catch {}
          }
        });
      }
    });
  }

  // =========================================================================
  // CANAL DE CHAT DE VOZ (ÁUDIO P2P) - TOTALMENTE INDEPENDENTE
  // =========================================================================

  setVoiceStream(stream: MediaStream | null) {
    this.voiceStream = stream;
    if (this.voiceStream) {
      this.voiceStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isVoiceMuted;
      });
    }

    // Atualiza faixa de voz em todas as conexões de voz ativas
    this.voicePeerConnections.forEach(pc => {
      if (pc.signalingState !== 'closed') {
        const senders = pc.getSenders();
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
        if (audioSender && this.voiceStream) {
          const track = this.voiceStream.getAudioTracks()[0];
          if (track) audioSender.replaceTrack(track).catch(() => {});
        } else if (this.voiceStream) {
          this.voiceStream.getAudioTracks().forEach(t => {
            try { pc.addTrack(t, this.voiceStream!); } catch {}
          });
        }
      }
    });
  }

  setVoiceMuted(muted: boolean) {
    this.isVoiceMuted = muted;
    if (this.voiceStream) {
      this.voiceStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
    this.voicePeerConnections.forEach(pc => {
      pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = !muted;
        }
      });
    });
  }

  setRemoteUserMuted(userId: string, isMuted: boolean) {
    if (isMuted) {
      this.mutedRemoteUsers.add(userId);
    } else {
      this.mutedRemoteUsers.delete(userId);
    }

    const audioEl = this.remoteAudioElements.get(userId);
    if (audioEl) {
      audioEl.muted = isMuted || this.isDeafened;
      audioEl.volume = isMuted ? 0 : 1;
    }
  }

  setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    this.remoteAudioElements.forEach((audioEl, userId) => {
      const isUserMuted = this.mutedRemoteUsers.has(userId);
      audioEl.muted = deafened || isUserMuted;
      audioEl.volume = (deafened || isUserMuted) ? 0 : 1;
    });
  }

  async connectToRoomPeers(otherUserIds: string[]) {
    for (const targetId of otherUserIds) {
      if (targetId && targetId !== this.currentUserId) {
        if (this.currentUserId < targetId) {
          await this.createVoiceOfferFor(targetId);
        }
      }
    }
  }

  private async createVoiceOfferFor(targetUserId: string) {
    try {
      const oldPc = this.voicePeerConnections.get(targetUserId);
      if (oldPc && oldPc.signalingState !== 'closed') return;

      const pc = new RTCPeerConnection(this.rtcConfig);
      this.voicePeerConnections.set(targetUserId, pc);

      if (this.voiceStream) {
        this.voiceStream.getAudioTracks().forEach(t => {
          pc.addTrack(t, this.voiceStream!);
        });
      }

      this.setupVoiceOntrack(pc, targetUserId);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          lanSyncClient.sendWebRtcSignal(targetUserId, {
            type: 'VOICE_CANDIDATE',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        }
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      lanSyncClient.sendWebRtcSignal(targetUserId, {
        type: 'VOICE_OFFER',
        offer,
      });
    } catch (err) {
      console.warn(`[Voice] Falha ao criar oferta de voz para ${targetUserId}:`, err);
    }
  }

  private async handleVoiceOffer(fromUserId: string, offer: RTCSessionDescriptionInit) {
    try {
      const pc = new RTCPeerConnection(this.rtcConfig);
      this.voicePeerConnections.set(fromUserId, pc);

      if (this.voiceStream) {
        this.voiceStream.getAudioTracks().forEach(t => {
          pc.addTrack(t, this.voiceStream!);
        });
      }

      this.setupVoiceOntrack(pc, fromUserId);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          lanSyncClient.sendWebRtcSignal(fromUserId, {
            type: 'VOICE_CANDIDATE',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const pending = this.pendingVoiceCandidates.get(fromUserId);
      if (pending && pending.length > 0) {
        for (const cand of pending) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
        }
        this.pendingVoiceCandidates.delete(fromUserId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      lanSyncClient.sendWebRtcSignal(fromUserId, {
        type: 'VOICE_ANSWER',
        answer,
      });
    } catch (err) {
      console.warn(`[Voice] Falha ao responder oferta de voz de ${fromUserId}:`, err);
    }
  }

  private async handleVoiceAnswer(fromUserId: string, answer: RTCSessionDescriptionInit) {
    try {
      const pc = this.voicePeerConnections.get(fromUserId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.warn(`[Voice] Falha ao aplicar resposta de voz de ${fromUserId}:`, err);
    }
  }

  private async handleVoiceCandidate(fromUserId: string, candidate: RTCIceCandidateInit) {
    try {
      if (!candidate || !candidate.candidate) return;
      const pc = this.voicePeerConnections.get(fromUserId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        const queue = this.pendingVoiceCandidates.get(fromUserId) || [];
        queue.push(candidate);
        this.pendingVoiceCandidates.set(fromUserId, queue);
      }
    } catch {}
  }

  private setupVoiceOntrack(pc: RTCPeerConnection, targetUserId: string) {
    pc.ontrack = (event) => {
      const track = event.track;
      if (track.kind === 'audio') {
        let audioEl = this.remoteAudioElements.get(targetUserId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `remote-audio-${targetUserId}`;
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          this.remoteAudioElements.set(targetUserId, audioEl);
        }
        const isUserMuted = this.mutedRemoteUsers.has(targetUserId);
        audioEl.muted = this.isDeafened || isUserMuted;
        audioEl.volume = (this.isDeafened || isUserMuted) ? 0 : 1;
        audioEl.srcObject = new MediaStream([track]);
        audioEl.play().catch(() => {
          const unlock = () => {
            audioEl?.play().catch(() => {});
            window.removeEventListener('click', unlock);
          };
          window.addEventListener('click', unlock, { once: true });
        });
      }
    };
  }

  closePeer(targetUserId: string) {
    const pcScreenS = this.screenSenders.get(targetUserId);
    if (pcScreenS) { try { pcScreenS.close(); } catch {} this.screenSenders.delete(targetUserId); }

    const pcScreenR = this.screenReceivers.get(targetUserId);
    if (pcScreenR) { try { pcScreenR.close(); } catch {} this.screenReceivers.delete(targetUserId); }

    const pcVoice = this.voicePeerConnections.get(targetUserId);
    if (pcVoice) { try { pcVoice.close(); } catch {} this.voicePeerConnections.delete(targetUserId); }

    const audioEl = this.remoteAudioElements.get(targetUserId);
    if (audioEl) {
      try { audioEl.srcObject = null; audioEl.remove(); } catch {}
      this.remoteAudioElements.delete(targetUserId);
    }

    this.remoteStreams.delete(targetUserId);
  }

  closeAll() {
    this.stopBroadcast();
    this.screenReceivers.forEach(pc => { try { pc.close(); } catch {} });
    this.screenReceivers.clear();
    this.voicePeerConnections.forEach(pc => { try { pc.close(); } catch {} });
    this.voicePeerConnections.clear();
    this.remoteAudioElements.forEach(el => { try { el.srcObject = null; el.remove(); } catch {} });
    this.remoteAudioElements.clear();
    this.remoteStreams.clear();
  }

  updateRoom(roomId: string) {
    this.currentRoomId = roomId;
    this.closeAll();
  }
}

export const webRtcMesh = new WebRtcMeshManager();
