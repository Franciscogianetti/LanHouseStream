/**
 * Cliente de Sincronização em Tempo Real para Salas, Participantes, Chat e Transmissões.
 * Conecta via WebSocket (/lan-sync) para permitir que múltiplos navegadores (Chrome, Edge, etc.)
 * e múltiplos dispositivos na mesma rede entrem e interajam nas salas em tempo real no localhost.
 */

import { Participant, ActiveStream, ChatMessage } from '../types/stream';

type EventCallback = (data: any) => void;

class LanSyncClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnecting = false;
  private reconnectTimer: any = null;
  private reconnectDelay = 2000;
  private currentUserId: string | null = null;
  private currentRoomId: string | null = null;
  private currentParticipant: Participant | null = null;
  private lastSpeakingUpdate = 0;
  private lastSpeakingState: boolean | undefined = undefined;

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  connect() {
    if (typeof window === 'undefined' || this.isConnecting) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/lan-sync`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectDelay = 2000;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        if (this.currentUserId) {
          this.send({ type: 'IDENTIFY', userId: this.currentUserId });
        }

        // Re-sincroniza a sala e o participante automaticamente ao reconectar
        if (this.currentRoomId && this.currentParticipant) {
          this.send({
            type: 'JOIN_ROOM',
            roomId: this.currentRoomId,
            participant: this.currentParticipant,
          });
        }

        // Solicita imediatamente o estado oficial das salas
        this.requestSync();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type) {
            this.emit(data.type, data);
          }
        } catch {}
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        try {
          this.ws?.close();
        } catch {}
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 10000);
      this.connect();
    }, this.reconnectDelay);
  }

  setUserId(id: string) {
    this.currentUserId = id;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'IDENTIFY', userId: id });
    }
  }

  send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {}
    } else {
      this.connect();
    }
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback) {
    const list = this.listeners.get(event);
    if (list) {
      list.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('[LanSync] Erro no listener do evento:', event, e);
        }
      });
    }
  }

  // Ações de Salas e Usuários
  joinRoom(roomId: string, participant: Participant) {
    this.currentUserId = participant.id;
    this.currentRoomId = roomId;
    this.currentParticipant = participant;
    this.send({
      type: 'JOIN_ROOM',
      roomId,
      participant,
    });
  }

  leaveRoom(roomId: string, userId: string, userName?: string) {
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
      this.currentParticipant = null;
    }
    this.send({
      type: 'LEAVE_ROOM',
      roomId,
      userId,
      userName: userName || this.currentParticipant?.name,
    });
  }

  updateUser(roomId: string, userId: string, updates: Partial<Participant>) {
    // Atualiza cópia local do participante para manter integridade no reconnect
    if (this.currentParticipant && this.currentParticipant.id === userId) {
      this.currentParticipant = { ...this.currentParticipant, ...updates };
    }

    // Evita loop de eventos para detecção contínua de voz (isSpeaking)
    if (updates.isSpeaking !== undefined) {
      const now = Date.now();
      if (this.lastSpeakingState === updates.isSpeaking && (now - this.lastSpeakingUpdate < 300)) {
        return;
      }
      this.lastSpeakingUpdate = now;
      this.lastSpeakingState = updates.isSpeaking;
    }

    this.send({
      type: 'USER_UPDATE',
      roomId,
      userId,
      updates,
    });
  }

  sendChatMessage(roomId: string, message: ChatMessage) {
    this.send({
      type: 'CHAT_MESSAGE',
      roomId,
      message,
    });
  }

  sendReaction(roomId: string, messageId: string, emoji: string, userId: string) {
    this.send({
      type: 'CHAT_REACTION',
      roomId,
      messageId,
      emoji,
      userId,
    });
  }

  startStream(roomId: string, stream: ActiveStream) {
    // Remove referências não serializáveis como mediaStream antes de enviar
    const serializableStream = {
      ...stream,
      mediaStream: null,
    };
    this.send({
      type: 'START_STREAM',
      roomId,
      stream: serializableStream,
    });
  }

  stopStream(roomId: string, streamId: string, participantId?: string) {
    this.send({
      type: 'STOP_STREAM',
      roomId,
      streamId,
      participantId,
    });
  }

  sendWebRtcSignal(targetUserId: string, signal: any) {
    this.send({
      type: 'WEBRTC_SIGNAL',
      targetUserId,
      fromUserId: this.currentUserId || this.currentParticipant?.id || this.currentParticipant?.name,
      signal,
    });
  }

  requestSync() {
    this.send({ type: 'GET_STATE' });
  }
}

export const lanSyncClient = new LanSyncClient();
