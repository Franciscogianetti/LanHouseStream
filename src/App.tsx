/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { TabView, StreamSource, StreamPreset, ChatMessage, ActiveStream, Participant } from './types/stream';
import {
  STREAM_SOURCES,
  STREAM_PRESETS,
  APP_ASSETS,
} from './data/mockData';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LAN_ROOMS, STORAGE_DISCORD_USER_KEY, STORAGE_IS_IN_ROOM_KEY } from './constants/lanRooms';
import { StageView } from './components/StageView';
import { WebcamModal } from './components/WebcamModal';
import { DisconnectModal } from './components/DisconnectModal';
import { DiscordAuthModal, DiscordUser } from './components/DiscordAuthModal';
import { ProfileModal } from './components/ProfileModal';
import { GridView } from './components/GridView';
import { RecordingsView } from './components/RecordingsView';
import { SettingsView } from './components/SettingsView';
import { Toast, ToastItem } from './components/Toast';
import { soundEffects } from './utils/audioAlerts';
import { resolveAvatarUrl } from './data/avatarOptions';
import { PasswordModal } from './components/PasswordModal';
import { VoiceDetector } from './utils/voiceDetector';
import { lanSyncClient } from './services/lanSyncClient';
import { webRtcMesh } from './services/webRtcMesh';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabView>('stage');
  const [currentChannel, setCurrentChannel] = useState<string>(() => {
    try {
      return localStorage.getItem('lanhouse_current_channel') || '#lan-house-transmissao-sala-1';
    } catch {
      return '#lan-house-transmissao-sala-1';
    }
  });
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [currentSource, setCurrentSource] = useState<StreamSource>(STREAM_SOURCES[0]);
  const [currentPreset, setCurrentPreset] = useState<StreamPreset>(STREAM_PRESETS[0]);
  const [selectedResolution, setSelectedResolution] = useState<string>('1080p');
  const [selectedFps, setSelectedFps] = useState<number>(30);
  const [isWebcamModalOpen, setIsWebcamModalOpen] = useState<boolean>(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  // Perfil personalizado salvo no navegador (Nome e Avatar escolhidos pelo usuário)
  const [customProfileName, setCustomProfileName] = useState<string>(() => {
    try {
      return localStorage.getItem('lanhouse_custom_name') || '';
    } catch {
      return '';
    }
  });

  const [customAvatar, setCustomAvatar] = useState<string>(() => {
    try {
      return localStorage.getItem('lanhouse_custom_avatar') || '';
    } catch {
      return '';
    }
  });

  // Autenticação Obrigatória pelo Discord (Persistência via localStorage para sobreviver a F5/Atualização)
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DISCORD_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Nome e Avatar efetivos para exibir em toda a aplicação
  const effectiveUserName = customProfileName || discordUser?.username || '';
  const effectiveAvatar = resolveAvatarUrl(customAvatar) || discordUser?.avatar || '';

  // Salas com senha desbloqueadas nesta sessão
  const [unlockedRooms, setUnlockedRooms] = useState<Set<string>>(() => new Set());
  const [passwordModalRoom, setPasswordModalRoom] = useState<string | null>(null);

  // Estrutura de Chats Exclusivos e Isolados para as 10 Salas
  const INITIAL_ROOM_CHATS: Record<string, ChatMessage[]> = Object.fromEntries(
    LAN_ROOMS.map(r => [r.id, []])
  );

  // Chats exclusivos separados por sala
  const [chatMessagesByRoom, setChatMessagesByRoom] = useState<Record<string, ChatMessage[]>>(INITIAL_ROOM_CHATS);

  // Transmissões de tela ativas separadas exclusivamente por sala
  const INITIAL_ACTIVE_STREAMS: Record<string, ActiveStream[]> = Object.fromEntries(
    LAN_ROOMS.map(r => [r.id, []])
  );
  const [activeStreamsByRoom, setActiveStreamsByRoom] = useState<Record<string, ActiveStream[]>>(INITIAL_ACTIVE_STREAMS);

  // Participantes conectados separados exclusivamente por sala (até 10 participantes por sala)
  const INITIAL_PARTICIPANTS: Record<string, Participant[]> = Object.fromEntries(
    LAN_ROOMS.map(r => [r.id, []])
  );
  const [participantsByRoom, setParticipantsByRoom] = useState<Record<string, Participant[]>>(INITIAL_PARTICIPANTS);

  // Dados exclusivos da sala atualmente selecionada
  const currentChatMessages = chatMessagesByRoom[currentChannel] || [];
  const currentActiveStreams = activeStreamsByRoom[currentChannel] || [];
  const currentParticipants = participantsByRoom[currentChannel] || [];

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [isNoiseSuppression, setIsNoiseSuppression] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lanhouse_noise_suppression');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [activeMicId, setActiveMicId] = useState<string>(() => {
    try {
      return localStorage.getItem('lanhouse_active_mic_id') || 'default';
    } catch {
      return 'default';
    }
  });

  const [activeSpeakerId, setActiveSpeakerId] = useState<string>(() => {
    try {
      return localStorage.getItem('lanhouse_active_speaker_id') || 'default';
    } catch {
      return 'default';
    }
  });

  const [detectedDevices, setDetectedDevices] = useState<{
    microphones: MediaDeviceInfo[];
    speakers: MediaDeviceInfo[];
    cameras: MediaDeviceInfo[];
  }>({ microphones: [], speakers: [], cameras: [] });

  const [isConnected, setIsConnected] = useState<boolean>(() => {
    try {
      const inRoom = localStorage.getItem(STORAGE_IS_IN_ROOM_KEY) === 'true';
      const hasUser = Boolean(localStorage.getItem(STORAGE_DISCORD_USER_KEY));
      return inRoom && hasUser;
    } catch {
      return false;
    }
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const userMicStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  // Mapeia e monitora em tempo real os dispositivos de áudio, microfone e câmera ativos no PC
  const refreshSystemDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(d => d.kind === 'audioinput');
      const speakers = devices.filter(d => d.kind === 'audiooutput');
      const cameras = devices.filter(d => d.kind === 'videoinput');
      setDetectedDevices({ microphones, speakers, cameras });
    } catch (err) {
      console.warn('Erro ao mapear dispositivos:', err);
    }
  };

  useEffect(() => {
    refreshSystemDevices();
    navigator.mediaDevices?.addEventListener('devicechange', refreshSystemDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', refreshSystemDevices);
    };
  }, []);

  // Alterna e aplica a supressão de ruído no microfone do usuário em tempo real
  const toggleNoiseSuppression = async () => {
    const nextState = !isNoiseSuppression;
    setIsNoiseSuppression(nextState);
    try {
      localStorage.setItem('lanhouse_noise_suppression', JSON.stringify(nextState));
    } catch {}

    if (userMicStreamRef.current) {
      const audioTracks = userMicStreamRef.current.getAudioTracks();
      for (const track of audioTracks) {
        try {
          await track.applyConstraints({
            noiseSuppression: nextState,
            echoCancellation: nextState,
            autoGainControl: nextState,
          });
        } catch (e) {
          console.warn('applyConstraints para supressão de ruído:', e);
        }
      }
    }

    showToast(
      nextState ? 'Supressão de ruído ativada' : 'Supressão de ruído desativada',
      nextState ? 'graphic_eq' : 'tune'
    );
  };

  // Captura o microfone ativo com supressão de ruído, cancelamento de eco e ganho automático
  const initMicrophone = async () => {
    if (userMicStreamRef.current && userMicStreamRef.current.active) {
      return userMicStreamRef.current;
    }
    try {
      let matchedDeviceId: string | undefined = undefined;
      const savedMicName = localStorage.getItem('lanhouse_input_device') || activeMicId;
      if (savedMicName && savedMicName !== 'default' && detectedDevices.microphones.length > 0) {
        const found = detectedDevices.microphones.find(m => m.label === savedMicName || m.deviceId === savedMicName);
        if (found) matchedDeviceId = found.deviceId;
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: matchedDeviceId ? { ideal: matchedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: isNoiseSuppression,
          autoGainControl: true,
        },
        video: false,
      };

      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      userMicStreamRef.current = micStream;
      webRtcMesh.setVoiceStream(micStream);
      refreshSystemDevices();
      return micStream;
    } catch (err) {
      console.warn('Microfone não acessível ou permissão negada:', err);
      return null;
    }
  };

  const handleSelectInputDevice = async (name: string) => {
    setActiveMicId(name);
    try {
      localStorage.setItem('lanhouse_active_mic_id', name);
    } catch {}
    if (userMicStreamRef.current) {
      userMicStreamRef.current.getTracks().forEach(t => t.stop());
      userMicStreamRef.current = null;
    }
    await initMicrophone();
  };

  const handleSelectOutputDevice = (name: string) => {
    setActiveSpeakerId(name);
    try {
      localStorage.setItem('lanhouse_active_speaker_id', name);
    } catch {}
    const found = detectedDevices.speakers.find(s => s.label === name);
    if (found && (HTMLMediaElement.prototype as any).setSinkId) {
      document.querySelectorAll('audio').forEach(el => {
        try { (el as any).setSinkId(found.deviceId); } catch {}
      });
    }
  };

  // Toast Helper
  const showToast = (message: string, icon: string = 'check_circle') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, icon }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  };

  // Keyboard shortcut Ctrl+D for mute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleMute();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMuted, discordUser]);

  // Autenticação com o Discord e entrada na Sala selecionada
  const handleDiscordLogin = (user: DiscordUser, selectedChannel?: string) => {
    setDiscordUser(user);
    try {
      localStorage.setItem(STORAGE_DISCORD_USER_KEY, JSON.stringify(user));
    } catch {}
    const channelToJoin = selectedChannel || currentChannel || '#lan-house-transmissao-sala-1';
    try {
      localStorage.setItem('lanhouse_current_channel', channelToJoin);
      localStorage.setItem(STORAGE_IS_IN_ROOM_KEY, 'true');
    } catch {}
    if (channelToJoin === '#lan-house-transmissao-sala-1') {
      setUnlockedRooms(prev => new Set(prev).add(channelToJoin));
    }
    setCurrentChannel(channelToJoin);
    setIsConnected(true);

    const room = LAN_ROOMS.find(r => r.id === channelToJoin);
    const roomName = room ? room.shortName : 'Sala 1';

    const displayName = customProfileName || user.username || 'Usuário';
    const displayAvatar = customAvatar || user.avatar;

    const userParticipant: Participant = {
      id: user.id,
      name: `${displayName} (Você)`,
      avatar: displayAvatar,
      role: 'host',
      isMuted: false,
      isDeafened: false,
      isCameraOn: false,
      isScreenSharing: false,
      isSpeaking: false,
    };

    // Insere o usuário conectado EXCLUSIVAMENTE na sala escolhida, preservando participantes já conectados
    setParticipantsByRoom(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        next[k] = (next[k] || []).filter(p => p.id !== user.id);
      });
      const existingInTarget = (next[channelToJoin] || []).filter(p => p.id !== user.id);
      next[channelToJoin] = [userParticipant, ...existingInTarget];
      return next;
    });

    lanSyncClient.joinRoom(channelToJoin, {
      ...userParticipant,
      name: displayName,
    });

    webRtcMesh.init(user.id, channelToJoin, (remoteUserId, remoteStream) => {
      remoteStreamsRef.current.set(remoteUserId, remoteStream);
      setActiveStreamsByRoom(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(rId => {
          const roomStreams = next[rId] || [];
          next[rId] = roomStreams.map(s => {
            const isMe = discordUser ? s.participantId === discordUser.id : false;
            if (isMe) return s;
            const matchesId = s.participantId === remoteUserId ||
              (remoteUserId && (String(s.participantId).includes(String(remoteUserId)) || String(remoteUserId).includes(String(s.participantId))));
            const matchesName = s.participantName && remoteUserId && s.participantName.toLowerCase().includes(String(remoteUserId).toLowerCase());
            const fallbackRemote = !isMe;
            return (matchesId || matchesName || fallbackRemote) ? { ...s, mediaStream: remoteStream } : s;
          });
        });
        return next;
      });
    });

    // Conecta imediatamente aos participantes da sala sem depender do microfone
    const otherIds = (participantsByRoom[channelToJoin] || [])
      .filter(p => p.id !== user.id)
      .map(p => p.id);
    if (otherIds.length > 0) {
      webRtcMesh.connectToRoomPeers(otherIds);
    }

    // Inicia microfone para voz em segundo plano (se falhar ou for negado, não bloqueia nada)
    initMicrophone().catch(() => null);

    // Notificação flutuante elegante que entra e sai sem floodar o chat
    soundEffects.playUserJoinSound();
    showToast(`${displayName} entrou na ${roomName}`, 'login');
  };

  // Restaura sessão automaticamente após recarregar a página (F5) APENAS se o usuário estava dentro de uma sala
  useEffect(() => {
    try {
      const wasInRoom = localStorage.getItem(STORAGE_IS_IN_ROOM_KEY) === 'true';
      if (discordUser && wasInRoom) {
        handleDiscordLogin(discordUser, currentChannel);
      }
    } catch {
      // Ignora erro
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentChannelRef = useRef(currentChannel);
  useEffect(() => {
    currentChannelRef.current = currentChannel;
  }, [currentChannel]);

  const isStreamingRef = useRef(isStreaming);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const isConnectedRef = useRef(isConnected);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Sincronização em Tempo Real via WebSocket (/lan-sync) entre todos os navegadores e dispositivos
  useEffect(() => {
    // 1. Estado oficial de todas as salas sincronizado pelo servidor
    const unsubInit = lanSyncClient.on('INIT_ROOMS_STATE', (data) => {
      if (data && data.rooms) {
        setParticipantsByRoom(prev => {
          const next = { ...prev };
          Object.keys(data.rooms).forEach(rId => {
            const serverParticipants: Participant[] = data.rooms[rId]?.participants || [];
            
            // Sincroniza estado de mudo remoto de todos os participantes recebidos
            serverParticipants.forEach(p => {
              if (discordUser && p.id !== discordUser.id && p.isMuted !== undefined) {
                webRtcMesh.setRemoteUserMuted(p.id, p.isMuted);
              }
            });

            // Mapeia todos os participantes presentes no servidor para essa sala
            next[rId] = serverParticipants.map(p => {
              const isMe = discordUser ? p.id === discordUser.id : p.name.includes('(Você)');
              const clean = p.name.replace(/\s*\(Você\)\s*/g, '').trim();
              return {
                ...p,
                name: isMe ? `${clean} (Você)` : clean,
              };
            });

            // Se o usuário logado está CONECTADO nesta sala mas o servidor ainda está processando o join, garante presença local
            if (isConnectedRef.current && discordUser && currentChannelRef.current === rId && !next[rId].some(p => p.id === discordUser.id)) {
              const displayName = customProfileName || discordUser.username || 'Usuário';
              const userParticipant: Participant = {
                id: discordUser.id,
                name: `${displayName} (Você)`,
                avatar: effectiveAvatar,
                role: 'host',
                isMuted,
                isDeafened,
                isCameraOn,
                isScreenSharing: false,
                isSpeaking: false,
              };
              next[rId] = [userParticipant, ...next[rId]];
            }
          });
          return next;
        });

        setActiveStreamsByRoom(prev => {
          const next = { ...prev };
          Object.keys(data.rooms).forEach(rId => {
            const serverStreams: ActiveStream[] = data.rooms[rId]?.activeStreams || [];
            const roomParticipants: Participant[] = data.rooms[rId]?.participants || [];
            const participantIds = new Set(roomParticipants.map((p: any) => p.id));

            // CRÍTICO: Só mantém transmissões se o streamer realmente estiver presente na lista de participantes da sala
            next[rId] = serverStreams
              .filter(s => participantIds.has(s.participantId))
              .map(s => {
                const isMine = discordUser && s.participantId === discordUser.id;
                if (isMine) {
                  const local = (prev[rId] || []).find(ls => ls.id === s.id);
                  return local || s;
                }
                const prevStream = (prev[rId] || []).find(ls => ls.id === s.id);
                let cached = remoteStreamsRef.current.get(s.participantId) || prevStream?.mediaStream;
                if (!cached) {
                  for (const [key, ms] of remoteStreamsRef.current.entries()) {
                    if (key === s.participantId || s.participantId.includes(key) || key.includes(s.participantId)) {
                      cached = ms;
                      break;
                    }
                  }
                  if (!cached && remoteStreamsRef.current.size === 1) {
                    cached = Array.from(remoteStreamsRef.current.values())[0];
                  }
                }
                if (!cached) {
                  webRtcMesh.requestStreamFrom(s.participantId);
                }
                return {
                  ...s,
                  mediaStream: cached || null,
                };
              });
          });
          return next;
        });

        setChatMessagesByRoom(prev => {
          const next = { ...prev };
          Object.keys(data.rooms).forEach(rId => {
            const serverMsgs: ChatMessage[] = data.rooms[rId]?.chatMessages || [];
            if (serverMsgs.length > 0) {
              next[rId] = serverMsgs;
            }
          });
          return next;
        });
      }
    });

    // 2. Outro usuário conectado no Chrome/Edge/rede entrou na sala
    const unsubJoin = lanSyncClient.on('USER_JOINED', (data) => {
      const { roomId, participant } = data;
      if (!participant) return;

      const isMe = discordUser && participant.id === discordUser.id;
      const clean = participant.name.replace(/\s*\(Você\)\s*/g, '').trim();
      const formatted: Participant = {
        ...participant,
        name: isMe ? `${clean} (Você)` : clean,
      };

      setParticipantsByRoom(prev => {
        const roomList = prev[roomId] || [];
        if (roomList.some(p => p.id === participant.id)) {
          return {
            ...prev,
            [roomId]: roomList.map(p => p.id === participant.id ? formatted : p),
          };
        }
        return {
          ...prev,
          [roomId]: [...roomList, formatted],
        };
      });

      // Se estamos transmitindo na mesma sala, conecta o novo peer via WebRTC
      if (isStreamingRef.current && currentChannelRef.current === roomId && !isMe) {
        webRtcMesh.connectToNewPeer(participant.id);
      } else if (!isMe && currentChannelRef.current === roomId) {
        webRtcMesh.connectToRoomPeers([participant.id]);
      }

      if (!isMe) {
        soundEffects.playUserJoinSound();
        const room = LAN_ROOMS.find(r => r.id === roomId);
        showToast(`${clean} entrou na ${room ? room.shortName : 'sala'}!`, 'person_add');
      }
    });

    // 3. Usuário saiu da sala ou fechou o navegador
    const unsubLeft = lanSyncClient.on('USER_LEFT', (data) => {
      const { roomId, userId, userName, removedStreamId, removedStreamIds } = data;
      if (!userId || (discordUser && userId === discordUser.id)) return;

      // Remove imediatamente o participante da lista
      setParticipantsByRoom(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter(p => p.id !== userId),
      }));

      // Remove TODAS as transmissões deste participante que saiu da sala
      const removedIds = new Set(removedStreamIds || (removedStreamId ? [removedStreamId] : []));
      setActiveStreamsByRoom(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter(s => s.participantId !== userId && !removedIds.has(s.id)),
      }));

      // Limpa conexão P2P WebRTC e faixa de vídeo remota em cache
      remoteStreamsRef.current.delete(userId);
      webRtcMesh.closePeer(userId);

      soundEffects.playUserLeaveSound();
      const room = LAN_ROOMS.find(r => r.id === roomId);
      showToast(`${userName || 'Participante'} saiu da ${room ? room.shortName : 'sala'}`, 'person_remove');
    });

    // 4. Usuário atualizado (falando, mutado, câmera, avatar, nome)
    const unsubUpdate = lanSyncClient.on('USER_UPDATED', (data) => {
      const { roomId, userId, updates } = data;
      if (!userId || (discordUser && userId === discordUser.id)) return;

      if (updates.isMuted !== undefined) {
        webRtcMesh.setRemoteUserMuted(userId, updates.isMuted);
      }

      setParticipantsByRoom(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map(p =>
          p.id === userId ? { ...p, ...updates } : p
        ),
      }));
    });

    // 5. Nova mensagem no chat da sala recebida de outro navegador
    const unsubChat = lanSyncClient.on('NEW_CHAT_MESSAGE', (data) => {
      const { roomId, message } = data;
      if (!message || (discordUser && message.senderId === discordUser.id)) return;

      setChatMessagesByRoom(prev => {
        const currentMsgs = prev[roomId] || [];
        if (currentMsgs.some(m => m.id === message.id)) return prev;
        const trimmed = currentMsgs.length >= 60 ? currentMsgs.slice(-59) : currentMsgs;
        return {
          ...prev,
          [roomId]: [...trimmed, message],
        };
      });
    });

    // 6. Transmissão iniciada por outro navegador
    const unsubStreamStart = lanSyncClient.on('STREAM_STARTED', (data) => {
      const { roomId, stream } = data;
      if (!stream || (discordUser && stream.participantId === discordUser.id)) return;

      let cachedStream = remoteStreamsRef.current.get(stream.participantId);
      if (!cachedStream) {
        for (const [key, ms] of remoteStreamsRef.current.entries()) {
          if (
            key === stream.participantId ||
            (stream.participantId && (key.includes(stream.participantId) || stream.participantId.includes(key))) ||
            (stream.participantName && key.toLowerCase().includes(stream.participantName.toLowerCase()))
          ) {
            cachedStream = ms;
            break;
          }
        }
      }

      const streamWithMedia = {
        ...stream,
        mediaStream: cachedStream || stream.mediaStream || null,
      };

      if (!cachedStream) {
        // Dispara solicitação imediata de retransmissão WebRTC sem espera
        webRtcMesh.requestStreamFrom(stream.participantId);
        setTimeout(() => {
          if (!remoteStreamsRef.current.get(stream.participantId)) {
            webRtcMesh.requestStreamFrom(stream.participantId);
          }
        }, 500);
        setTimeout(() => {
          if (!remoteStreamsRef.current.get(stream.participantId)) {
            webRtcMesh.requestStreamFrom(stream.participantId);
          }
        }, 1200);
      }

      setActiveStreamsByRoom(prev => {
        const currentStreams = prev[roomId] || [];
        if (currentStreams.some(s => s.id === stream.id)) {
          return {
            ...prev,
            [roomId]: currentStreams.map(s =>
              s.id === stream.id ? { ...streamWithMedia, mediaStream: cachedStream || s.mediaStream } : s
            ),
          };
        }
        return {
          ...prev,
          [roomId]: [...currentStreams, streamWithMedia],
        };
      });

      showToast(`${stream.participantName} começou a transmitir na ${LAN_ROOMS.find(r => r.id === roomId)?.shortName || 'sala'}!`, 'screen_share');
    });

    // 7. Transmissão finalizada
    const unsubStreamStop = lanSyncClient.on('STREAM_STOPPED', (data) => {
      const { roomId, streamId, participantId } = data;
      setActiveStreamsByRoom(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).filter(s => s.id !== streamId && (!participantId || s.participantId !== participantId)),
      }));
      if (participantId) {
        remoteStreamsRef.current.delete(participantId);
        webRtcMesh.closePeer(participantId);
        setParticipantsByRoom(prev => ({
          ...prev,
          [roomId]: (prev[roomId] || []).map(p =>
            p.id === participantId ? { ...p, isScreenSharing: false } : p
          ),
        }));
      }
    });

    // Sincronização contínua inteligente: re-solicita o estado oficial do servidor ao focar na janela e a cada 3.5 segundos
    const handleWindowFocus = () => {
      lanSyncClient.requestSync();
    };
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('visibilitychange', handleWindowFocus);

    const syncInterval = setInterval(() => {
      lanSyncClient.requestSync();
    }, 3500);

    return () => {
      unsubInit();
      unsubJoin();
      unsubLeft();
      unsubUpdate();
      unsubChat();
      unsubStreamStart();
      unsubStreamStop();
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('visibilitychange', handleWindowFocus);
      clearInterval(syncInterval);
    };
  }, [discordUser, effectiveAvatar, isMuted, isDeafened, isCameraOn, customProfileName]);

  // Detector de Voz em Tempo Real (Web Audio API)
  // Otimizado: reutiliza o MediaStream do microfone existente sem conflito de hardware
  useEffect(() => {
    if (!isConnected || isMuted || !discordUser) {
      return;
    }

    const detector = new VoiceDetector((isSpeaking) => {
      const targetRoom = currentChannelRef.current;
      setParticipantsByRoom(prev => {
        const roomUsers = prev[targetRoom] || [];
        const currentSpeaking = roomUsers.find(p => p.id === discordUser.id)?.isSpeaking;
        if (currentSpeaking === isSpeaking) return prev;

        return {
          ...prev,
          [targetRoom]: roomUsers.map(p =>
            p.id === discordUser.id ? { ...p, isSpeaking } : p
          ),
        };
      });

      // Notifica em tempo real os outros navegadores que o usuário começou/parou de falar
      lanSyncClient.updateUser(targetRoom, discordUser.id, { isSpeaking });
    });

    detector.start(userMicStreamRef.current);

    return () => {
      detector.stop();
    };
  }, [isConnected, isMuted, discordUser]);

  // Permite clicar no participante para testar a borda verde de fala
  const handleToggleUserSpeaking = (userId: string) => {
    setParticipantsByRoom(prev => ({
      ...prev,
      [currentChannel]: (prev[currentChannel] || []).map(p =>
        p.id === userId ? { ...p, isSpeaking: !p.isSpeaking } : p
      ),
    }));
  };

  // Atualização em tempo real da qualidade e resolução da transmissão ativa (Sem derrubar a conexão)
  const handleSelectPreset = async (preset: StreamPreset) => {
    setCurrentPreset(preset);

    const is1080 = preset.quality.includes('1080p');
    const is720 = preset.quality.includes('720p');
    const is480 = preset.quality.includes('480p');
    const is360 = preset.quality.includes('360p');

    const targetWidth = is1080 ? 1920 : is720 ? 1280 : is480 ? 854 : 640;
    const targetHeight = is1080 ? 1080 : is720 ? 720 : is480 ? 480 : 360;
    const targetFps = preset.fps || 60;
    const resLabel = is1080 ? '1920 x 1080' : is720 ? '1280 x 720' : is480 ? '854 x 480' : '640 x 360';

    // 1. Troca Dinâmica de Resolução (Sem derrubar a conexão):
    // Utilize track.applyConstraints() diretamente na faixa de vídeo ativa para alterar resolução e FPS sem interromper o fluxo
    await webRtcMesh.applyVideoConstraints(targetWidth, targetHeight, targetFps);

    // Atualiza imediatamente na transmissão ativa do usuário (metadados e faixa WebRTC)
    setActiveStreamsByRoom(prev => {
      const roomStreams = prev[currentChannel] || [];
      const myId = discordUser?.id || 'main-user';
      return {
        ...prev,
        [currentChannel]: roomStreams.map(s => {
          const isMine = s.participantId === myId || s.id.includes(myId) || s.id === 'stream-main-user';
          if (isMine) {
            if (s.mediaStream) {
              const videoTrack = s.mediaStream.getVideoTracks()[0];
              if (videoTrack && videoTrack.applyConstraints) {
                videoTrack.applyConstraints({
                  width: { ideal: targetWidth },
                  height: { ideal: targetHeight },
                  frameRate: { ideal: targetFps },
                }).catch(err => {
                  console.log('applyConstraints ajustado pelo navegador:', err);
                });
              }
            }
            return {
              ...s,
              resolution: resLabel,
              fps: `${targetFps} FPS`,
            };
          }
          return s;
        }),
      };
    });

    setCurrentSource(prev => ({
      ...prev,
      resolution: resLabel,
      fps: `${targetFps} FPS`,
    }));
  };

  // Toggle Mute (isolado na sala atual)
  const toggleMute = () => {
    if (!discordUser) return;
    const nextState = !isMuted;
    setIsMuted(nextState);

    // Muta ou desmuta a faixa de áudio do microfone enviada via WebRTC
    if (userMicStreamRef.current) {
      userMicStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextState;
      });
    } else if (!nextState) {
      initMicrophone();
    }

    webRtcMesh.setVoiceMuted(nextState);

    setParticipantsByRoom(prev => ({
      ...prev,
      [currentChannel]: (prev[currentChannel] || []).map(p =>
        p.id === discordUser.id ? { ...p, isMuted: nextState, isSpeaking: false } : p
      ),
    }));
    lanSyncClient.updateUser(currentChannel, discordUser.id, { isMuted: nextState, isSpeaking: false });
    showToast(nextState ? 'Microfone silenciado' : 'Microfone ativado', nextState ? 'mic_off' : 'mic');
  };

  // Toggle Deafen
  const toggleDeafen = () => {
    const nextState = !isDeafened;
    setIsDeafened(nextState);
    webRtcMesh.setDeafened(nextState);
    if (discordUser) {
      lanSyncClient.updateUser(currentChannel, discordUser.id, { isDeafened: nextState });
    }
    showToast(nextState ? 'Áudio da chamada desativado' : 'Áudio restaurado', nextState ? 'headset_off' : 'headset');
  };

  // Toggle Camera (isolado na sala atual)
  const toggleCamera = () => {
    if (isCameraOn) {
      if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
        setWebcamStream(null);
      }
      setIsCameraOn(false);
      if (discordUser) {
        setParticipantsByRoom(prev => ({
          ...prev,
          [currentChannel]: (prev[currentChannel] || []).map(p =>
            p.id === discordUser.id ? { ...p, isCameraOn: false } : p
          ),
        }));
        lanSyncClient.updateUser(currentChannel, discordUser.id, { isCameraOn: false });
      }
      showToast('Câmera desativada', 'videocam_off');
    } else {
      setIsWebcamModalOpen(true);
    }
  };

  // Selecionar webcam física do PC
  const handleSelectWebcam = async (deviceId: string, label: string) => {
    try {
      if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId && deviceId !== 'fhd-cam' ? { deviceId: { ideal: deviceId } } : true,
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      setWebcamStream(stream);
      setIsCameraOn(true);
      if (discordUser) {
        setParticipantsByRoom(prev => ({
          ...prev,
          [currentChannel]: (prev[currentChannel] || []).map(p =>
            p.id === discordUser.id ? { ...p, isCameraOn: true } : p
          ),
        }));
        lanSyncClient.updateUser(currentChannel, discordUser.id, { isCameraOn: true });
      }
      showToast(`Câmera ativada: ${label}`, 'videocam');
    } catch (err) {
      console.warn('Erro ao acessar webcam:', err);
      setIsCameraOn(true);
      showToast(`Câmera ativada: ${label}`, 'videocam');
    }
  };

  // Início Direto do Compartilhamento de Tela via Seletor Nativo do Google Chrome (Sem modal intermediário)
  const handleStartDirectScreenShare = async () => {
    if (isStreaming) {
      toggleStreaming();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast('Navegador não suporta compartilhamento de tela', 'error');
      return;
    }

    try {
      // Configuração exata de acordo com a resolução (1080p, 720p, 480p ou 360p) e FPS (60 ou 30) escolhidos
      const is1080 = currentPreset.quality.includes('1080p');
      const is720 = currentPreset.quality.includes('720p');
      const is480 = currentPreset.quality.includes('480p');
      const is360 = currentPreset.quality.includes('360p');

      const targetWidth = is1080 ? 1920 : is720 ? 1280 : is480 ? 854 : 640;
      const targetHeight = is1080 ? 1080 : is720 ? 720 : is480 ? 480 : 360;
      const targetFps = currentPreset.fps || 60;
      const resLabel = is1080 ? '1920 x 1080' : is720 ? '1280 x 720' : is480 ? '854 x 480' : '640 x 360';

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          console.log('Compartilhamento cancelado pelo usuário no navegador:', err);
          return;
        }
        // Não interrompe o fluxo caso o sistema não tenha áudio de captura disponível
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      }

      const track = stream.getVideoTracks()[0];
      const windowTitle = track.label || 'Janela / Tela do Windows';

      // Ao usuário parar pelo botão nativo do Chrome "Interromper compartilhamento"
      track.onended = () => {
        handleCloseStream('stream-main-user');
      };

      const customSource: StreamSource = {
        id: `native-screen-${Date.now()}`,
        name: windowTitle,
        category: 'screens',
        resolution: resLabel,
        fps: `${targetFps} FPS`,
        subtext: `Transmissão Real • ${currentPreset.name}`,
        image: '',
        icon: 'desktop_windows',
        badge: `${currentPreset.quality.split(' ')[0]} ${targetFps}FPS`,
      };

      handleSelectSource(customSource, stream.getAudioTracks().length > 0, 100, stream);
    } catch (err) {
      // Cancelado no seletor nativo do Chrome pelo usuário
      console.log('Compartilhamento cancelado pelo usuário no navegador:', err);
    }
  };

  // Toggle Streaming State (exclusivo para a sala atual)
  const toggleStreaming = () => {
    if (isStreaming) {
      handleCloseStream(`stream-${discordUser?.id || 'main-user'}`);
      showToast('Transmissão encerrada', 'stop_screen_share');
    } else {
      handleStartDirectScreenShare();
    }
  };

  // Clique em desconectar sai da sala e abre a tela de escolher a sala
  const handleTriggerDisconnect = () => {
    handleConfirmExit();
  };

  // Reconectar à chamada (Sim) com suporte às 10 salas
  const handleConfirmReconnect = (selectedChannelId: string) => {
    setIsDisconnectModalOpen(false);
    setIsConnected(true);

    if (selectedChannelId === '#lan-house-transmissao-sala-1') {
      setUnlockedRooms(prev => new Set(prev).add(selectedChannelId));
    }

    if (selectedChannelId !== currentChannel) {
      proceedToChannel(selectedChannelId);
    } else {
      soundEffects.playUserJoinSound();
      const currentRoom = LAN_ROOMS.find(r => r.id === selectedChannelId);
      showToast(`Reconectado com sucesso à ${currentRoom ? currentRoom.shortName : 'Sala'}`, 'replay');
    }
  };

  // Sair da sala e da transmissão (Não)
  const handleConfirmExit = () => {
    setIsDisconnectModalOpen(false);

    if (discordUser) {
      if (isStreaming) {
        lanSyncClient.stopStream(currentChannel, `stream-${discordUser.id}`, discordUser.id);
      }
      lanSyncClient.leaveRoom(currentChannel, discordUser.id, effectiveUserName);
      webRtcMesh.stopBroadcast();
    }

    try {
      localStorage.removeItem('lanhouse_current_channel');
      localStorage.removeItem(STORAGE_IS_IN_ROOM_KEY);
    } catch {}

    if (userMicStreamRef.current) {
      userMicStreamRef.current.getTracks().forEach(t => t.stop());
      userMicStreamRef.current = null;
    }
    webRtcMesh.setVoiceStream(null);

    // Parar todas as faixas de mídia de todas as salas
    Object.values(activeStreamsByRoom).forEach(streams => {
      streams.forEach(s => s.mediaStream?.getTracks().forEach(t => t.stop()));
    });
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      setWebcamStream(null);
    }

    setActiveStreamsByRoom(INITIAL_ACTIVE_STREAMS);
    setParticipantsByRoom(INITIAL_PARTICIPANTS);
    setIsStreaming(false);
    setIsCameraOn(false);
    setIsConnected(false);

    // Bip de despedida
    soundEffects.playUserLeaveSound();
    const currentRoom = LAN_ROOMS.find(r => r.id === currentChannel);
    showToast(`Você saiu da transmissão e da ${currentRoom ? currentRoom.shortName : 'Sala'}`, 'call_end');
  };

  // Handle Share Invite Link
  const handleShareInvite = () => {
    navigator.clipboard?.writeText(window.location.href);
    showToast('Link do convite copiado para a área de transferência!', 'link');
  };

  // Troca de sala efetiva
  const proceedToChannel = (channel: string) => {
    const oldChannel = currentChannel;
    setCurrentChannel(channel);
    setIsConnected(true);
    try {
      localStorage.setItem('lanhouse_current_channel', channel);
      localStorage.setItem(STORAGE_IS_IN_ROOM_KEY, 'true');
    } catch {}

    const newRoom = LAN_ROOMS.find(r => r.id === channel);
    const newRoomName = newRoom ? newRoom.fullName : channel;

    // Se estava transmitindo na sala anterior, interrompe o stream na sala antiga
    if (isStreaming && discordUser) {
      lanSyncClient.stopStream(oldChannel, `stream-${discordUser.id}`, discordUser.id);
      setIsStreaming(false);
      webRtcMesh.stopBroadcast();
    }

    // Transfere o usuário conectado da sala antiga para a nova sala
    if (discordUser) {
      const displayName = customProfileName || discordUser.username || 'Usuário';
      const userObj: Participant = {
        id: discordUser.id,
        name: `${displayName} (Você)`,
        avatar: effectiveAvatar,
        role: 'host' as const,
        isMuted,
        isDeafened,
        isCameraOn,
        isScreenSharing: false,
        isSpeaking: false,
      };

      // Remove da sala anterior
      setParticipantsByRoom(prev => {
        const next = { ...prev };
        next[oldChannel] = (next[oldChannel] || []).filter(p => p.id !== discordUser.id);
        const existingInNew = (next[channel] || []).filter(p => p.id !== discordUser.id);
        next[channel] = [userObj, ...existingInNew];
        return next;
      });

      // Sincroniza a troca de sala com o servidor e outros navegadores
      lanSyncClient.joinRoom(channel, {
        ...userObj,
        name: displayName,
      });
      webRtcMesh.updateRoom(channel);

      const otherIds = (participantsByRoom[channel] || [])
        .filter(p => p.id !== discordUser.id)
        .map(p => p.id);
      if (otherIds.length > 0) {
        webRtcMesh.connectToRoomPeers(otherIds);
      }
      initMicrophone().catch(() => null);
    }

    soundEffects.playUserJoinSound();
    showToast(`Você entrou na ${newRoomName}`, 'meeting_room');
  };

  // Solicita troca de sala - protege a Sala 1 com senha
  const handleSelectChannel = (channel: string) => {
    if (channel === currentChannel && isConnected) return;

    if (channel === '#lan-house-transmissao-sala-1' && !unlockedRooms.has('#lan-house-transmissao-sala-1')) {
      setPasswordModalRoom(channel);
      return;
    }

    proceedToChannel(channel);
  };

  // Sucesso na digitação da senha da Sala 1
  const handlePasswordModalSuccess = () => {
    if (passwordModalRoom) {
      setUnlockedRooms(prev => new Set(prev).add(passwordModalRoom));
      proceedToChannel(passwordModalRoom);
      setPasswordModalRoom(null);
      showToast('Acesso liberado à Sala 1 com sucesso!', 'lock_open');
    }
  };

  // Handle source selection (Captura em Tempo Real do PC - Exclusiva na sala atual)
  const handleSelectSource = (
    source: StreamSource,
    audioCaptured: boolean,
    audioGain: number,
    realStream?: MediaStream
  ) => {
    setCurrentSource(source);
    setIsStreaming(true);

    if (discordUser) {
      setParticipantsByRoom(prev => ({
        ...prev,
        [currentChannel]: (prev[currentChannel] || []).map(p =>
          p.id === discordUser.id ? { ...p, isScreenSharing: true } : p
        ),
      }));
    }

    const myStreamId = `stream-${discordUser?.id || 'main-user'}`;

    // Monitora encerramento nativo pelo navegador
    if (realStream) {
      const track = realStream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          handleCloseStream(myStreamId);
        };
      }
    }

    const currentUserName = `${effectiveUserName} (Você)`;
    const currentUserAvatar = effectiveAvatar;

    const streamObj: ActiveStream = {
      id: myStreamId,
      participantId: discordUser?.id || 'user-1',
      participantName: effectiveUserName,
      participantAvatar: currentUserAvatar,
      title: source.name,
      type: source.category === 'apps' ? 'app' : 'screen',
      resolution: source.resolution,
      fps: source.fps,
      mediaStream: realStream || null,
      appIcon: source.icon,
    };

    // Atualiza ou insere a transmissão principal do usuário EXCLUSIVAMENTE na sala atual
    setActiveStreamsByRoom(prev => {
      const roomStreams = prev[currentChannel] || [];
      const withoutUser = roomStreams.filter(s => s.participantId !== (discordUser?.id || 'user-1'));
      return {
        ...prev,
        [currentChannel]: [
          { ...streamObj, participantName: currentUserName },
          ...withoutUser,
        ],
      };
    });

    // Transmite início de tela em tempo real para os outros navegadores
    lanSyncClient.startStream(currentChannel, streamObj);
    if (realStream) {
      const otherUserIds = (participantsByRoom[currentChannel] || [])
        .filter(p => p.id !== discordUser?.id)
        .map(p => p.id);
      webRtcMesh.startBroadcast(realStream, otherUserIds);
    }

    // Notificação flutuante de início de transmissão (entra e sai automaticamente sem poluir o chat)
    showToast(`${currentUserName} começou a transmitir na ${LAN_ROOMS.find(r => r.id === currentChannel)?.shortName || 'sala'}!`, 'screen_share');
  };

  // Fechar uma transmissão individual (X) - Exclusivo na sala atual
  const handleCloseStream = (streamId: string) => {
    setActiveStreamsByRoom(prev => {
      const roomStreams = prev[currentChannel] || [];
      const target = roomStreams.find(s => s.id === streamId);
      if (target?.mediaStream) {
        target.mediaStream.getTracks().forEach(t => t.stop());
      }
      const updated = roomStreams.filter(s => s.id !== streamId);
      return {
        ...prev,
        [currentChannel]: updated,
      };
    });

    const isMyStream = streamId === `stream-${discordUser?.id || 'main-user'}` || streamId === 'stream-main-user';
    if (isMyStream) {
      setIsStreaming(false);
      webRtcMesh.stopBroadcast();
      if (discordUser) {
        setParticipantsByRoom(pState => ({
          ...pState,
          [currentChannel]: (pState[currentChannel] || []).map(p =>
            p.id === discordUser.id ? { ...p, isScreenSharing: false } : p
          ),
        }));
        lanSyncClient.stopStream(currentChannel, streamId, discordUser.id);
      }
    }
  };

  // Adicionar transmissão de outro participante para testar grade (na sala atual)
  const handleAddTestStream = () => {
    const roomStreams = activeStreamsByRoom[currentChannel] || [];
    if (roomStreams.length >= 10) {
      showToast('Limite máximo de 10 telas na chamada atingido', 'warning');
      return;
    }

    const samplePool = [
      { name: 'Sarah.K', title: 'Google Chrome - YouTube', type: 'app' as const },
      { name: 'Devin_R', title: 'Visual Studio Code', type: 'app' as const },
      { name: 'Lucas.V', title: 'Discord App', type: 'app' as const },
      { name: 'Helena.M', title: 'Canva Desktop', type: 'app' as const },
      { name: 'Thiago.G', title: 'Battle.net Client', type: 'app' as const },
      { name: 'Marcio_Dev', title: 'Tela 2 (Secundária)', type: 'screen' as const },
      { name: 'Julia.P', title: 'Tela 3 (Auxiliar)', type: 'screen' as const },
      { name: 'Renato_99', title: 'Tela 4 (Vertical)', type: 'screen' as const },
      { name: 'Bia_Live', title: 'EA App Games', type: 'app' as const },
      { name: 'Alex.F', title: 'Riot Client', type: 'app' as const },
    ];

    const sample = samplePool[roomStreams.length % samplePool.length];

    let testMediaStream: MediaStream | null = null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 1280, 720);
        grad.addColorStop(0, '#0a1a12');
        grad.addColorStop(0.5, '#122e20');
        grad.addColorStop(1, '#05110b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        ctx.strokeStyle = '#4edea3';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, 1240, 680);

        ctx.fillStyle = '#4edea3';
        ctx.font = 'bold 38px sans-serif';
        ctx.fillText(`🎮 ${sample.name} - Transmissão Ao Vivo`, 60, 110);

        ctx.fillStyle = '#dfe4e0';
        ctx.font = '26px sans-serif';
        ctx.fillText(`Janela Compartilhada: ${sample.title}`, 60, 170);
        ctx.font = '20px monospace';
        ctx.fillStyle = '#00ffaa';
        ctx.fillText('1080p • 60 FPS • Sincronização WebRTC', 60, 220);

        ctx.fillStyle = '#18241e';
        ctx.fillRect(60, 260, 1160, 380);
        ctx.strokeStyle = '#274237';
        ctx.strokeRect(60, 260, 1160, 380);

        ctx.fillStyle = '#4edea3';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('Transmissão de Tela Conectada', 100, 420);
        ctx.fillStyle = '#bbcabf';
        ctx.font = '20px sans-serif';
        ctx.fillText('Layout vertical empilhado: telas preenchidas de ponta a ponta.', 100, 470);

        if ((canvas as any).captureStream) {
          testMediaStream = (canvas as any).captureStream(30);
        }
      }
    } catch {}

    const newStream: ActiveStream = {
      id: `stream-test-${Date.now()}-${roomStreams.length}`,
      participantId: `guest-${roomStreams.length + 1}`,
      participantName: sample.name,
      participantAvatar: '',
      title: sample.title,
      type: sample.type,
      resolution: '1920 x 1080',
      fps: '60 FPS',
      mediaStream: testMediaStream,
    };

    setActiveStreamsByRoom(prev => ({
      ...prev,
      [currentChannel]: [...(prev[currentChannel] || []), newStream],
    }));
    setIsStreaming(true);
    showToast(`Nova tela na grade da sala: ${sample.name}`, 'screen_share');
  };

  // Simular outro participante entrando na sala (na sala atual)
  const handleSimulateUserJoin = () => {
    const roomPeers = participantsByRoom[currentChannel] || [];
    if (roomPeers.length >= 10) {
      const room = LAN_ROOMS.find(r => r.id === currentChannel);
      showToast(`A ${room ? room.shortName : 'sala'} já atingiu o limite de 10 participantes.`, 'warning');
      return;
    }

    const mockNames = ['Sarah.K', 'Devin_R', 'Lucas.V', 'Helena.M', 'Thiago.G', 'Marcio_Dev', 'Julia.P', 'Renato_99', 'Bia_Live'];
    const availableName = mockNames.find(n => !roomPeers.some(p => p.name.includes(n))) || `Gamer_${roomPeers.length + 1}`;

    const newParticipant: Participant = {
      id: `peer-${Date.now()}`,
      name: availableName,
      avatar: '',
      role: 'spectator',
      isMuted: false,
      isDeafened: false,
      isCameraOn: false,
      isScreenSharing: false,
      isSpeaking: true,
    };

    setParticipantsByRoom(prev => ({
      ...prev,
      [currentChannel]: [...(prev[currentChannel] || []), newParticipant],
    }));

    // Notificação flutuante que entra e sai automaticamente
    soundEffects.playUserJoinSound();
    const room = LAN_ROOMS.find(r => r.id === currentChannel);
    showToast(`${availableName} entrou na ${room ? room.shortName : 'sala'}`, 'person_add');
  };

  // Simular participante saindo da sala atual
  const handleSimulateUserLeave = () => {
    const roomPeers = participantsByRoom[currentChannel] || [];
    const peers = roomPeers.filter(p => p.id !== (discordUser?.id || ''));
    if (peers.length === 0) {
      showToast('Nenhum outro participante na chamada para sair.', 'info');
      return;
    }

    const peerToLeave = peers[peers.length - 1];
    setParticipantsByRoom(prev => ({
      ...prev,
      [currentChannel]: (prev[currentChannel] || []).filter(p => p.id !== peerToLeave.id),
    }));

    // Remove eventuais transmissões desse participante na sala atual
    setActiveStreamsByRoom(prev => ({
      ...prev,
      [currentChannel]: (prev[currentChannel] || []).filter(s => s.participantId !== peerToLeave.id),
    }));

    // Notificação flutuante de saída
    soundEffects.playUserLeaveSound();
    const room = LAN_ROOMS.find(r => r.id === currentChannel);
    showToast(`${peerToLeave.name} saiu da ${room ? room.shortName : 'sala'}`, 'person_remove');
  };

  // Handle sending new chat message (exclusivo para a sala atual)
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const senderName = effectiveUserName;

    const newMsg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      senderId: discordUser?.id || 'user-1',
      senderName,
      senderRole: 'STREAMER',
      text,
      time: timeStr,
      reactions: [],
    };

    setChatMessagesByRoom(prev => {
      const existing = prev[currentChannel] || [];
      const trimmed = existing.length >= 60 ? existing.slice(-59) : existing;
      return {
        ...prev,
        [currentChannel]: [...trimmed, newMsg],
      };
    });

    // Transmite a mensagem em tempo real para os outros navegadores
    lanSyncClient.sendChatMessage(currentChannel, newMsg);
  };

  // Handle reaction clicks on messages (exclusivo para a sala atual)
  const handleToggleReaction = (messageId: string, emoji: string) => {
    setChatMessagesByRoom(prev => ({
      ...prev,
      [currentChannel]: (prev[currentChannel] || []).map(msg => {
        if (msg.id !== messageId) return msg;
        const currentReactions = msg.reactions || [];
        const existing = currentReactions.find(r => r.emoji === emoji);

        if (existing) {
          const hasReacted = !existing.hasReacted;
          const count = hasReacted ? existing.count + 1 : Math.max(0, existing.count - 1);
          return {
            ...msg,
            reactions: currentReactions.map(r =>
              r.emoji === emoji ? { ...r, count, hasReacted } : r
            ),
          };
        } else {
          return {
            ...msg,
            reactions: [...currentReactions, { emoji, count: 1, hasReacted: true }],
          };
        }
      }),
    }));

    lanSyncClient.sendReaction(currentChannel, messageId, emoji, discordUser?.id || 'user-1');
  };

  // Salva nome e avatar escolhidos pelo usuário no ProfileModal
  const handleSaveProfile = (newName: string, newAvatar: string) => {
    setCustomProfileName(newName);
    setCustomAvatar(newAvatar);
    try {
      localStorage.setItem('lanhouse_custom_name', newName);
      localStorage.setItem('lanhouse_custom_avatar', newAvatar);
    } catch {}

    // Sincroniza discordUser se logado
    if (discordUser) {
      const updatedUser = {
        ...discordUser,
        username: newName,
        avatar: newAvatar,
      };
      setDiscordUser(updatedUser);
      try {
        localStorage.setItem(STORAGE_DISCORD_USER_KEY, JSON.stringify(updatedUser));
      } catch {}

      // Atualiza nos participantes da sala atual
      setParticipantsByRoom(prev => ({
        ...prev,
        [currentChannel]: (prev[currentChannel] || []).map(p =>
          p.id === discordUser.id ? { ...p, name: `${newName} (Você)`, avatar: newAvatar } : p
        ),
      }));

      // Sincroniza em tempo real com outros navegadores
      lanSyncClient.updateUser(currentChannel, discordUser.id, { name: newName, avatar: newAvatar });

      // Atualiza também nas transmissões ativas
      setActiveStreamsByRoom(prev => ({
        ...prev,
        [currentChannel]: (prev[currentChannel] || []).map(s =>
          s.id === 'stream-main-user' ? { ...s, participantName: `${newName} (Você)`, participantAvatar: newAvatar } : s
        ),
      }));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-[#dfe4e0] font-sans selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      {/* Tela de Escolha de Sala e Autenticação via Discord */}
      {(!isConnected || !discordUser) && (
        <DiscordAuthModal onSuccessLogin={handleDiscordLogin} />
      )}

      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onShareInvite={handleShareInvite}
        onOpenProfileSettings={() => setIsProfileModalOpen(true)}
        roomName={LAN_ROOMS.find(r => r.id === currentChannel)?.shortName || 'Sala 1'}
        streamQuality={currentPreset.quality}
        isStreaming={currentActiveStreams.length > 0}
        participantCount={currentParticipants.length}
        userProfileName={effectiveUserName}
        userAvatar={effectiveAvatar}
      />

      {/* Main Layout */}
      <div className="pt-16 flex">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentChannel={currentChannel}
          onSelectChannel={handleSelectChannel}
          participants={currentParticipants}
          isConnected={isConnected}
          onDisconnectToggle={handleTriggerDisconnect}
          unlockedRooms={unlockedRooms}
          onRequestPasswordRoom={roomId => setPasswordModalRoom(roomId)}
          onToggleUserSpeaking={handleToggleUserSpeaking}
          currentUserId={discordUser?.id}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          isDeafened={isDeafened}
          onToggleDeafen={toggleDeafen}
          isNoiseSuppression={isNoiseSuppression}
          onToggleNoiseSuppression={toggleNoiseSuppression}
        />

        {/* Dynamic Center Views with md:pl-64 offset for sidebar */}
        <main className="flex-1 md:pl-64 min-w-0">
          {currentTab === 'stage' && (
            <StageView
              currentSource={currentSource}
              isStreaming={isStreaming}
              onToggleStreaming={toggleStreaming}
              onOpenSourceModal={handleStartDirectScreenShare}
              participants={currentParticipants}
              currentPreset={currentPreset}
              onSelectPreset={handleSelectPreset}
              chatMessages={currentChatMessages}
              onSendMessage={handleSendMessage}
              onToggleReaction={handleToggleReaction}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              isDeafened={isDeafened}
              onToggleDeafen={toggleDeafen}
              isNoiseSuppression={isNoiseSuppression}
              onToggleNoiseSuppression={toggleNoiseSuppression}
              isCameraOn={isCameraOn}
              onToggleCamera={toggleCamera}
              onDisconnect={handleTriggerDisconnect}
              onShowToast={showToast}
              activeStreams={currentActiveStreams}
              onCloseStream={handleCloseStream}
              onAddTestStream={handleAddTestStream}
              onOpenWebcamModal={() => setIsWebcamModalOpen(true)}
              webcamStream={webcamStream}
              currentUserName={effectiveUserName}
              currentUserId={discordUser?.id}
              onSimulateJoin={handleSimulateUserJoin}
              onSimulateLeave={handleSimulateUserLeave}
            />
          )}

          {currentTab === 'grid' && (
            <GridView
              currentSource={currentSource}
              isStreaming={currentActiveStreams.length > 0}
              participants={currentParticipants}
              onOpenSourceModal={handleStartDirectScreenShare}
              onShowToast={showToast}
            />
          )}

          {currentTab === 'recordings' && (
            <RecordingsView onShowToast={showToast} />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              currentUser={discordUser ? { ...discordUser, username: effectiveUserName, avatar: effectiveAvatar } : null}
              currentRoomName={LAN_ROOMS.find(r => r.id === currentChannel)?.fullName || 'Sala 1'}
              currentPreset={currentPreset}
              onSelectPreset={setCurrentPreset}
              onShowToast={showToast}
              selectedResolution={selectedResolution}
              onSelectResolution={res => {
                setSelectedResolution(res);
                const resMap: Record<string, string> = {
                  '1080p': '1920 x 1080',
                  '720p': '1280 x 720',
                  '480p': '854 x 480',
                };
                setCurrentSource(prev => ({
                  ...prev,
                  resolution: resMap[res] || '1920 x 1080',
                }));
              }}
              selectedFps={selectedFps}
              onSelectFps={fps => {
                setSelectedFps(fps);
                setCurrentSource(prev => ({
                  ...prev,
                  fps: `${fps} FPS`,
                }));
              }}
              onSelectInputDevice={handleSelectInputDevice}
              onSelectOutputDevice={handleSelectOutputDevice}
            />
          )}
        </main>
      </div>

      {/* Modal de Configurações de Perfil (Mudar Nome e Avatar) */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentName={effectiveUserName === 'Você' ? '' : effectiveUserName}
        currentAvatar={effectiveAvatar}
        discordOriginalAvatar={discordUser?.avatar}
        onSaveProfile={handleSaveProfile}
        onShowToast={showToast}
        onOpenHardwareSettings={() => setCurrentTab('settings')}
      />

      {/* Seleção de Webcam Física Conectada ao PC */}
      <WebcamModal
        isOpen={isWebcamModalOpen}
        onClose={() => setIsWebcamModalOpen(false)}
        onSelectWebcam={handleSelectWebcam}
      />

      {/* Janela de Desconexão: "Você saiu da sala / da transmissão. Reconectar com escolha entre as 10 salas" */}
      <DisconnectModal
        isOpen={isDisconnectModalOpen}
        currentChannel={currentChannel}
        onReconnect={handleConfirmReconnect}
        onExit={handleConfirmExit}
      />

      {/* Modal de Senha para Salas Protegidas (Sala 1 - senha: lanhouse) */}
      <PasswordModal
        isOpen={!!passwordModalRoom}
        onClose={() => setPasswordModalRoom(null)}
        onSuccess={handlePasswordModalSuccess}
        roomName={LAN_ROOMS.find(r => r.id === passwordModalRoom)?.shortName || 'Sala 1'}
      />

      {/* Floating Notifications */}
      <Toast toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}
