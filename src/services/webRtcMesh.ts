/**
 * Gerenciador WebRTC P2P para compartilhamento de tela e áudio/voz em tempo real
 * entre múltiplos navegadores (Chrome, Edge, Firefox, Opera) e dispositivos na rede local.
 */

import { lanSyncClient } from './lanSyncClient';

export class WebRtcMeshManager {
  private localStream: MediaStream | null = null; // Compartilhamento de tela (vídeo + áudio do sistema)
  private voiceStream: MediaStream | null = null; // Microfone do usuário (voz)
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private mutedRemoteUsers: Set<string> = new Set();
  private onRemoteStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private currentUserId: string = '';
  private currentRoomId: string = '';
  private unsubSignal: (() => void) | null = null;
  private isDeafened: boolean = false;
  private isVoiceMuted: boolean = false;

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
        if (signal.type === 'OFFER') {
          await this.handleOffer(fromUserId, signal.offer);
        } else if (signal.type === 'ANSWER') {
          await this.handleAnswer(fromUserId, signal.answer);
        } else if (signal.type === 'CANDIDATE') {
          await this.handleCandidate(fromUserId, signal.candidate);
        } else if (signal.type === 'REQUEST_STREAM') {
          if (this.localStream) {
            await this.connectToNewPeer(fromUserId);
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Erro no processamento de sinal:', err);
      }
    });
  }

  // Atualiza ou conecta o microfone de voz do usuário
  setVoiceStream(stream: MediaStream | null) {
    this.voiceStream = stream;
    if (this.voiceStream) {
      this.voiceStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isVoiceMuted;
      });
    }

    // Anexa a faixa de microfone em todas as conexões ativas e renegocia a oferta
    this.peerConnections.forEach((pc, targetId) => {
      if (pc.signalingState !== 'closed') {
        this.attachLocalTracks(pc);
        if (pc.signalingState === 'stable') {
          this.createOfferFor(targetId);
        }
      }
    });
  }

  // Muta ou desmuta o microfone do usuário local em todas as transmissões WebRTC
  setVoiceMuted(muted: boolean) {
    this.isVoiceMuted = muted;
    if (this.voiceStream) {
      this.voiceStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }

    // Muta todos os senders de áudio ativos nas conexões WebRTC
    this.peerConnections.forEach(pc => {
      pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = !muted;
        }
      });
    });
  }

  // Muta ou desmuta o elemento de áudio de um participante remoto específico
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

  // Alterna o ensurdecimento (muta todos os áudios recebidos)
  setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    this.remoteAudioElements.forEach((audioEl, userId) => {
      const isUserMuted = this.mutedRemoteUsers.has(userId);
      audioEl.muted = deafened || isUserMuted;
      audioEl.volume = (deafened || isUserMuted) ? 0 : 1;
    });
  }

  updateRoom(roomId: string) {
    this.currentRoomId = roomId;
    this.closeAll();
  }

  // Inicia transmissão de tela local enviando ofertas para todos os outros participantes da sala
  async startBroadcast(stream: MediaStream, otherUserIds: string[]) {
    this.localStream = stream;

    for (const targetId of otherUserIds) {
      if (targetId && targetId !== this.currentUserId) {
        await this.createOfferFor(targetId);
      }
    }
  }

  // Conecta e envia o stream para um novo participante que entrou na sala
  async connectToNewPeer(targetUserId: string) {
    if (targetUserId && targetUserId !== this.currentUserId) {
      await this.createOfferFor(targetUserId);
    }
  }

  // Conecta a todos os participantes da sala para chat de voz mútuo
  async connectToRoomPeers(otherUserIds: string[]) {
    for (const targetId of otherUserIds) {
      if (targetId && targetId !== this.currentUserId) {
        // Conexão iniciada por um dos lados de forma estável
        if (this.currentUserId < targetId) {
          await this.createOfferFor(targetId);
        }
      }
    }
  }

  // Solicita retransmissão P2P para um streamer específico caso a mídia ainda não tenha chegado
  requestStreamFrom(streamerUserId: string) {
    if (streamerUserId && streamerUserId !== this.currentUserId) {
      lanSyncClient.sendWebRtcSignal(streamerUserId, {
        type: 'REQUEST_STREAM',
      });
    }
  }

  stopBroadcast() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      this.localStream = null;
    }
    // Remove as faixas de vídeo das conexões mas mantém a voz ativa
    this.peerConnections.forEach((pc, targetId) => {
      const senders = pc.getSenders();
      senders.forEach(sender => {
        if (sender.track && sender.track.kind === 'video') {
          try { pc.removeTrack(sender); } catch {}
        }
      });
    });
  }

  private getOrCreatePeerConnection(targetUserId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(targetUserId);
    if (pc && pc.signalingState !== 'closed') {
      this.attachLocalTracks(pc);
      return pc;
    }

    pc = new RTCPeerConnection(this.rtcConfig);

    // Envio de candidatos ICE locais
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        lanSyncClient.sendWebRtcSignal(targetUserId, {
          type: 'CANDIDATE',
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      }
    };

    // Recebimento de faixa remota (vídeo de tela ou áudio de voz)
    pc.ontrack = (event) => {
      const track = event.track;
      console.log(`[WebRTC] Faixa recebida de ${targetUserId}: kind=${track.kind}`);

      if (track.kind === 'audio') {
        // Áudio de voz do participante: anexa ao DOM e reproduz
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

      if (track.kind === 'video') {
        let stream = event.streams && event.streams[0];
        if (!stream) {
          let existing = this.remoteStreams.get(targetUserId);
          if (!existing) {
            existing = new MediaStream();
          }
          if (!existing.getTracks().includes(track)) {
            existing.addTrack(track);
          }
          stream = existing;
        }
        this.remoteStreams.set(targetUserId, stream);

        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(targetUserId, stream);
        }

        const notifyStreamActive = () => {
          if (this.onRemoteStreamCallback) {
            const activeStream = this.remoteStreams.get(targetUserId) || stream;
            if (activeStream) {
              this.onRemoteStreamCallback(targetUserId, activeStream);
            }
          }
        };

        track.onunmute = notifyStreamActive;
        track.onended = notifyStreamActive;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {}
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {}
      }
    };

    this.attachLocalTracks(pc);
    this.peerConnections.set(targetUserId, pc);
    return pc;
  }

  private attachLocalTracks(pc: RTCPeerConnection) {
    const tracksToAttach: { track: MediaStreamTrack; stream: MediaStream }[] = [];
    if (this.voiceStream) {
      this.voiceStream.getAudioTracks().forEach(t => {
        t.enabled = !this.isVoiceMuted;
        tracksToAttach.push({ track: t, stream: this.voiceStream! });
      });
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => {
        tracksToAttach.push({ track: t, stream: this.localStream! });
      });
    }

    const senders = pc.getSenders();
    const attachedTracks = senders.map(s => s.track).filter(Boolean);

    tracksToAttach.forEach(({ track, stream }) => {
      if (!attachedTracks.includes(track)) {
        try {
          pc.addTrack(track, stream);
        } catch {}
      }
    });
  }

  // Modifica SDP para priorizar codec VP8 e eliminar tela preta no Chrome/Edge
  private preferVP8(sdp: string): string {
    const lines = sdp.split('\r\n');
    const mLineIndex = lines.findIndex(l => l.startsWith('m=video'));
    if (mLineIndex === -1) return sdp;

    const mLine = lines[mLineIndex];
    const elements = mLine.split(' ');
    const header = elements.slice(0, 3);
    const payloadTypes = elements.slice(3);

    const vp8Payloads: string[] = [];
    lines.forEach(l => {
      if (l.startsWith('a=rtpmap:')) {
        const parts = l.split(' ');
        const pt = parts[0].split(':')[1];
        const name = parts[1].split('/')[0];
        if (name && name.toLowerCase() === 'vp8') {
          vp8Payloads.push(pt);
        }
      }
    });

    if (vp8Payloads.length === 0) return sdp;

    const otherPayloads = payloadTypes.filter(pt => !vp8Payloads.includes(pt));
    lines[mLineIndex] = [...header, ...vp8Payloads, ...otherPayloads].join(' ');
    return lines.join('\r\n');
  }

  // Define preferências de codecs nos transceivers para VP8
  private setPreferredCodecs(pc: RTCPeerConnection) {
    if (typeof RTCRtpSender !== 'undefined' && 'getCapabilities' in RTCRtpSender) {
      try {
        const caps = RTCRtpSender.getCapabilities('video');
        if (caps && caps.codecs) {
          const vp8 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/vp8');
          const others = caps.codecs.filter(c => c.mimeType.toLowerCase() !== 'video/vp8');
          const sorted = [...vp8, ...others];
          pc.getTransceivers().forEach(transceiver => {
            if (
              transceiver.sender.track?.kind === 'video' ||
              transceiver.receiver.track?.kind === 'video' ||
              transceiver.mid === null
            ) {
              try {
                transceiver.setCodecPreferences(sorted);
              } catch {}
            }
          });
        }
      } catch {}
    }
  }

  private async createOfferFor(targetUserId: string) {
    try {
      let pc = this.peerConnections.get(targetUserId);
      if (pc) {
        if (pc.signalingState === 'have-local-offer') {
          // Já existe uma oferta enviada aguardando resposta
          return;
        }
        if (pc.signalingState !== 'stable') {
          // Aguarda estabilizar a sinalização antes de renegociar
          setTimeout(() => {
            const currentPc = this.peerConnections.get(targetUserId);
            if (currentPc && currentPc.signalingState === 'stable') {
              this.createOfferFor(targetUserId);
            }
          }, 400);
          return;
        }
      }

      if (!pc || pc.signalingState === 'closed') {
        pc = this.getOrCreatePeerConnection(targetUserId);
      } else {
        this.attachLocalTracks(pc);
      }

      this.setPreferredCodecs(pc);

      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
      });

      if (pc.signalingState !== 'stable') {
        return;
      }

      let finalOffer: RTCSessionDescriptionInit = offer;
      try {
        const sdpVP8 = this.preferVP8(offer.sdp || '');
        finalOffer = {
          type: offer.type,
          sdp: sdpVP8,
        };
        await pc.setLocalDescription(finalOffer);
      } catch {
        await pc.setLocalDescription(offer);
        finalOffer = offer;
      }

      lanSyncClient.sendWebRtcSignal(targetUserId, {
        type: 'OFFER',
        offer: finalOffer,
      });
    } catch (err) {
      console.warn(`[WebRTC] Falha ao criar oferta para ${targetUserId}:`, err);
    }
  }

  private async handleOffer(fromUserId: string, offer: RTCSessionDescriptionInit) {
    try {
      let pc = this.peerConnections.get(fromUserId);
      const isOfferCollision = pc && pc.signalingState !== 'stable';
      const isPolite = this.currentUserId < fromUserId;

      if (isOfferCollision && pc) {
        if (!isPolite) {
          // Impolite peer mantém sua própria oferta; o polite peer aceitará
          return;
        }
        // Polite peer: desfaz a oferta local pendente para receber a oferta remota
        try {
          await pc.setLocalDescription({ type: 'rollback' });
        } catch {
          try { pc.close(); } catch {}
          this.peerConnections.delete(fromUserId);
          pc = undefined;
        }
      }

      if (!pc || pc.signalingState === 'closed') {
        pc = this.getOrCreatePeerConnection(fromUserId);
      } else {
        this.attachLocalTracks(pc);
      }

      this.setPreferredCodecs(pc);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Despeja candidatos ICE acumulados antes do remoteDescription
      await this.drainPendingCandidates(fromUserId, pc);

      if (pc.signalingState !== 'have-remote-offer') {
        return;
      }

      const answer = await pc.createAnswer();
      if (pc.signalingState !== 'have-remote-offer') {
        return;
      }

      let finalAnswer: RTCSessionDescriptionInit = answer;
      try {
        const sdpVP8 = this.preferVP8(answer.sdp || '');
        finalAnswer = {
          type: answer.type,
          sdp: sdpVP8,
        };
        await pc.setLocalDescription(finalAnswer);
      } catch {
        try {
          await pc.setLocalDescription(answer);
          finalAnswer = answer;
        } catch (e: any) {
          if (e?.name === 'InvalidStateError') return;
          throw e;
        }
      }

      lanSyncClient.sendWebRtcSignal(fromUserId, {
        type: 'ANSWER',
        answer: finalAnswer,
      });
    } catch (err) {
      console.warn(`[WebRTC] Falha ao responder oferta de ${fromUserId}:`, err);
    }
  }

  private async handleAnswer(fromUserId: string, answer: RTCSessionDescriptionInit) {
    try {
      const pc = this.peerConnections.get(fromUserId);
      if (!pc || pc.signalingState !== 'have-local-offer') {
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await this.drainPendingCandidates(fromUserId, pc);
      } catch (e: any) {
        if (e?.name === 'InvalidStateError') return;
        throw e;
      }
    } catch (err) {
      console.warn(`[WebRTC] Falha ao aplicar resposta de ${fromUserId}:`, err);
    }
  }

  private async handleCandidate(fromUserId: string, candidate: RTCIceCandidateInit) {
    try {
      if (!candidate || !candidate.candidate) return;
      const pc = this.peerConnections.get(fromUserId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      } else {
        const queue = this.pendingCandidates.get(fromUserId) || [];
        queue.push(candidate);
        this.pendingCandidates.set(fromUserId, queue);
      }
    } catch (err) {
      console.warn(`[WebRTC] Falha ao adicionar candidato ICE de ${fromUserId}:`, err);
    }
  }

  private async drainPendingCandidates(userId: string, pc: RTCPeerConnection) {
    const queue = this.pendingCandidates.get(userId);
    if (!queue || queue.length === 0) return;

    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {}
    }
    this.pendingCandidates.delete(userId);
  }

  closePeer(targetUserId: string) {
    const pc = this.peerConnections.get(targetUserId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      this.peerConnections.delete(targetUserId);
    }
    const audioEl = this.remoteAudioElements.get(targetUserId);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {}
      this.remoteAudioElements.delete(targetUserId);
    }
    this.pendingCandidates.delete(targetUserId);
    this.remoteStreams.delete(targetUserId);
  }

  closeAll() {
    if (this.unsubSignal) {
      this.unsubSignal();
      this.unsubSignal = null;
    }
    this.peerConnections.forEach(pc => {
      try { pc.close(); } catch {}
    });
    this.peerConnections.clear();
    this.remoteAudioElements.forEach(audioEl => {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {}
    });
    this.remoteAudioElements.clear();
    this.pendingCandidates.clear();
    this.remoteStreams.clear();
  }
}

export const webRtcMesh = new WebRtcMeshManager();
