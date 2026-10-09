/**
 * Gerenciador WebRTC de Alta Performance estilo GoLive / Discord
 * Separação completa de canais:
 * 1. Canal de Voz: RTCPeerConnection dedicado para áudio de microfone
 * 2. Canal de Transmissão de Tela (GoLive): RTCPeerConnections dedicadas exclusivamente para vídeo/áudio de tela
 * Zero colisões, zero travamentos de renegociação, funciona em qualquer rede, PC e navegador.
 */

import { lanSyncClient } from './lanSyncClient';

export class WebRtcMeshManager {
  // Transmissão de Tela local e remota (GoLive)
  private localStream: MediaStream | null = null;
  private screenSenders: Map<string, RTCPeerConnection> = new Map(); // viewerId -> pc
  private screenReceivers: Map<string, RTCPeerConnection> = new Map(); // streamerId -> pc
  private pendingScreenCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map(); // streamerId -> MediaStream

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
   * Inicia transmissão de tela local criando conexões dedicadas para cada espectador
   */
  async startBroadcast(stream: MediaStream, otherUserIds: string[]) {
    this.localStream = stream;

    // Envia oferta direta para todos os participantes atualmente na sala
    for (const viewerId of otherUserIds) {
      if (viewerId && viewerId !== this.currentUserId) {
        await this.sendScreenOffer(viewerId);
      }
    }
  }

  /**
   * Envia oferta de transmissão de tela dedicada para um espectador específico
   */
  async sendScreenOffer(viewerId: string) {
    if (!this.localStream || !viewerId || viewerId === this.currentUserId) return;

    try {
      // Fecha conexão anterior se já existia para recriar um canal 100% limpo
      const oldPc = this.screenSenders.get(viewerId);
      if (oldPc) {
        try { oldPc.close(); } catch {}
      }

      const pc = new RTCPeerConnection(this.rtcConfig);
      this.screenSenders.set(viewerId, pc);

      // Anexa todas as faixas da transmissão de tela (vídeo e áudio)
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });

      // Envia candidatos ICE para o espectador
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          lanSyncClient.sendWebRtcSignal(viewerId, {
            type: 'STREAM_CANDIDATE',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false,
      });

      await pc.setLocalDescription(offer);

      lanSyncClient.sendWebRtcSignal(viewerId, {
        type: 'STREAM_OFFER',
        offer,
      });
    } catch (err) {
      console.warn(`[GoLive] Falha ao enviar oferta de tela para ${viewerId}:`, err);
    }
  }

  /**
   * Espectador recebe a oferta de tela e configura o receptor de vídeo dedicado
   */
  private async handleStreamOffer(streamerId: string, offer: RTCSessionDescriptionInit) {
    try {
      const oldPc = this.screenReceivers.get(streamerId);
      if (oldPc) {
        try { oldPc.close(); } catch {}
      }

      const pc = new RTCPeerConnection(this.rtcConfig);
      this.screenReceivers.set(streamerId, pc);

      // Quando a faixa de vídeo chegar, vincula imediatamente ao reprodutor
      pc.ontrack = (event) => {
        const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
        this.remoteStreams.set(streamerId, stream);

        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(streamerId, stream);
        }

        event.track.onunmute = () => {
          if (this.onRemoteStreamCallback) {
            this.onRemoteStreamCallback(streamerId, stream);
          }
        };
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          lanSyncClient.sendWebRtcSignal(streamerId, {
            type: 'STREAM_CANDIDATE',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Despeja candidatos pendentes
      const pending = this.pendingScreenCandidates.get(streamerId);
      if (pending && pending.length > 0) {
        for (const cand of pending) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
        }
        this.pendingScreenCandidates.delete(streamerId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      lanSyncClient.sendWebRtcSignal(streamerId, {
        type: 'STREAM_ANSWER',
        answer,
      });
    } catch (err) {
      console.warn(`[GoLive] Falha ao processar oferta de tela de ${streamerId}:`, err);
    }
  }

  /**
   * Transmissor recebe a resposta do espectador
   */
  private async handleStreamAnswer(viewerId: string, answer: RTCSessionDescriptionInit) {
    try {
      const pc = this.screenSenders.get(viewerId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.warn(`[GoLive] Falha ao aplicar resposta de tela de ${viewerId}:`, err);
    }
  }

  /**
   * Processa candidato ICE da transmissão de tela
   */
  private async handleStreamCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    try {
      if (!candidate || !candidate.candidate) return;
      const pc = this.screenReceivers.get(peerId) || this.screenSenders.get(peerId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        const queue = this.pendingScreenCandidates.get(peerId) || [];
        queue.push(candidate);
        this.pendingScreenCandidates.set(peerId, queue);
      }
    } catch {}
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
   * Interrompe o compartilhamento de tela local
   */
  stopBroadcast() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      this.localStream = null;
    }

    this.screenSenders.forEach(pc => {
      try { pc.close(); } catch {}
    });
    this.screenSenders.clear();
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
