import { WebSocketServer, WebSocket } from 'ws';

/**
 * Servidor de Sincronização em Tempo Real da Lan House Stream
 * Sincroniza participantes, salas, chat, transmissões e WebRTC entre
 * múltiplos navegadores (Chrome, Edge, etc.) e dispositivos na rede local.
 */

const LAN_ROOM_IDS = [
  '#lan-house-transmissao-sala-1',
  '#lan-house-transmissao-sala-2',
  '#lan-house-transmissao-sala-3',
  '#lan-house-transmissao-sala-4',
  '#lan-house-transmissao-sala-5',
  '#lan-house-transmissao-sala-6',
  '#lan-house-transmissao-sala-7',
  '#lan-house-transmissao-sala-8',
  '#lan-house-transmissao-sala-9',
  '#lan-house-transmissao-sala-10',
];

// Estado centralizado em memória no servidor
const roomsState = {};
LAN_ROOM_IDS.forEach(roomId => {
  roomsState[roomId] = {
    participants: new Map(), // userId -> participant
    activeStreams: new Map(), // streamId -> stream
    chatMessages: [], // array de ChatMessage
  };
});

// Serializa o estado das salas para envio JSON
function serializeRoomsState() {
  const result = {};
  LAN_ROOM_IDS.forEach(roomId => {
    result[roomId] = {
      participants: Array.from(roomsState[roomId].participants.values()),
      activeStreams: Array.from(roomsState[roomId].activeStreams.values()),
      chatMessages: roomsState[roomId].chatMessages,
    };
  });
  return result;
}

export function setupLanSyncServer(httpServer) {
  if (httpServer._lanSyncCleanupInterval) {
    try {
      clearInterval(httpServer._lanSyncCleanupInterval);
    } catch {}
  }

  if (httpServer._lanSyncWss) {
    try {
      httpServer._lanSyncWss.close();
    } catch {}
  }

  if (httpServer._lanSyncUpgradeListener) {
    httpServer.removeListener('upgrade', httpServer._lanSyncUpgradeListener);
  }

  const wss = new WebSocketServer({ noServer: true });
  httpServer._lanSyncWss = wss;

  const onUpgrade = (request, socket, head) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/lan-sync') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
      // Se for outro caminho (como Vite HMR), NÃO interfere no socket!
    } catch (e) {
      // Ignora erro de parsing de URL
    }
  };

  httpServer._lanSyncUpgradeListener = onUpgrade;
  httpServer.on('upgrade', onUpgrade);

  console.log('[LanSync] Servidor WebSocket de Sincronização em Tempo Real ativo em /lan-sync');

  function broadcast(payload, excludeWs = null) {
    const raw = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        try {
          client.send(raw);
        } catch (e) {
          console.error('[LanSync] Erro ao enviar mensagem para cliente:', e);
        }
      }
    }
  }

  function sendToUser(targetUserId, payload) {
    const raw = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN && client.userId === targetUserId) {
        try {
          client.send(raw);
        } catch (e) {
          console.error('[LanSync] Erro ao enviar sinal P2P:', e);
        }
      }
    }
  }

  // Remove um usuário e todas as suas transmissões ativas de uma sala específica
  function removeUserFromRoom(roomId, userId, userName = 'Participante') {
    if (!roomsState[roomId]) return false;
    let changed = false;

    // Remove por id exato, string de id, ou nome do participante
    for (const [pId, p] of roomsState[roomId].participants.entries()) {
      const matchId = userId && (pId === userId || p.id === userId || String(pId) === String(userId));
      const matchName = userName && userName !== 'Participante' && p.name && (p.name === userName || p.name.includes(userName));
      if (matchId || matchName) {
        userName = p?.name || userName;
        roomsState[roomId].participants.delete(pId);
        changed = true;
      }
    }

    // Remove TODAS as transmissões deste usuário nesta sala
    const removedStreams = [];
    for (const [sId, s] of roomsState[roomId].activeStreams.entries()) {
      const matchStreamUser = userId && (s.participantId === userId || String(s.participantId) === String(userId));
      const matchStreamName = userName && userName !== 'Participante' && s.participantName && (s.participantName === userName || s.participantName.includes(userName));
      if (matchStreamUser || matchStreamName) {
        roomsState[roomId].activeStreams.delete(sId);
        removedStreams.push(sId);
        changed = true;
      }
    }

    if (changed) {
      removedStreams.forEach(streamId => {
        broadcast({
          type: 'STREAM_STOPPED',
          roomId,
          streamId,
          participantId: userId,
        });
      });

      broadcast({
        type: 'USER_LEFT',
        roomId,
        userId,
        userName,
        removedStreamId: removedStreams[0] || null,
        removedStreamIds: removedStreams,
      });
    }

    return changed;
  }

  // Remove o usuário e todas as suas transmissões de todas as salas (exceto opcionalmente a sala alvo)
  function removeUserFromAllRooms(userId, excludeRoomId = null, userName = 'Participante') {
    let anyChanged = false;
    LAN_ROOM_IDS.forEach(rId => {
      if (rId !== excludeRoomId) {
        const changed = removeUserFromRoom(rId, userId, userName);
        if (changed) anyChanged = true;
      }
    });
    if (anyChanged) {
      broadcast({
        type: 'INIT_ROOMS_STATE',
        rooms: serializeRoomsState(),
      });
    }
    return anyChanged;
  }

  wss.on('connection', (ws) => {
    ws.userId = null;
    ws.currentRoomId = null;
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Envia o estado atual de todas as 10 salas assim que conecta
    ws.send(JSON.stringify({
      type: 'INIT_ROOMS_STATE',
      rooms: serializeRoomsState(),
    }));

    ws.on('message', (messageRaw) => {
      try {
        const data = JSON.parse(messageRaw.toString());
        const { type } = data;

        switch (type) {
          case 'IDENTIFY': {
            ws.userId = data.userId;
            break;
          }

          case 'GET_STATE': {
            ws.send(JSON.stringify({
              type: 'INIT_ROOMS_STATE',
              rooms: serializeRoomsState(),
            }));
            break;
          }

          case 'JOIN_ROOM': {
            const { roomId, participant } = data;
            if (!roomsState[roomId] || !participant || !participant.id) return;

            ws.userId = participant.id;
            ws.userName = participant.name;
            ws.currentRoomId = roomId;

            // Remove o usuário de QUALQUER outra sala onde ele estivesse antes
            removeUserFromAllRooms(participant.id, roomId, participant.name);

            // Adiciona ou atualiza na sala alvo
            roomsState[roomId].participants.set(participant.id, participant);

            // Transmite o estado completo atualizado para TODOS os navegadores conectados (Chrome, Edge, etc.)
            broadcast({
              type: 'INIT_ROOMS_STATE',
              rooms: serializeRoomsState(),
            });

            // Transmite para os outros navegadores conectados o evento direto de entrada
            broadcast({
              type: 'USER_JOINED',
              roomId,
              participant,
            }, ws);
            break;
          }

          case 'LEAVE_ROOM': {
            const { roomId, userId, userName } = data;
            const targetUserId = userId || ws.userId;
            const targetUserName = userName || ws.userName || 'Participante';
            if (targetUserId) {
              removeUserFromAllRooms(targetUserId, null, targetUserName);
              ws.currentRoomId = null;
              broadcast({
                type: 'INIT_ROOMS_STATE',
                rooms: serializeRoomsState(),
              });
            }
            break;
          }

          case 'USER_UPDATE': {
            const { roomId, userId, updates } = data;
            if (roomsState[roomId] && roomsState[roomId].participants.has(userId)) {
              const current = roomsState[roomId].participants.get(userId);
              const updated = { ...current, ...updates };
              roomsState[roomId].participants.set(userId, updated);

              broadcast({
                type: 'USER_UPDATED',
                roomId,
                userId,
                updates,
              });
            }
            break;
          }

          case 'CHAT_MESSAGE': {
            const { roomId, message } = data;
            if (roomsState[roomId] && message) {
              const chatList = roomsState[roomId].chatMessages;
              chatList.push(message);
              // Limita histórico a 60 mensagens
              if (chatList.length > 60) {
                roomsState[roomId].chatMessages = chatList.slice(-60);
              }

              broadcast({
                type: 'NEW_CHAT_MESSAGE',
                roomId,
                message,
              });
            }
            break;
          }

          case 'CHAT_REACTION': {
            const { roomId, messageId, emoji, userId } = data;
            if (roomsState[roomId]) {
              const msg = roomsState[roomId].chatMessages.find(m => m.id === messageId);
              if (msg) {
                msg.reactions = msg.reactions || [];
                const existing = msg.reactions.find(r => r.emoji === emoji);
                if (existing) {
                  existing.hasReacted = !existing.hasReacted;
                  existing.count = existing.hasReacted ? existing.count + 1 : Math.max(0, existing.count - 1);
                } else {
                  msg.reactions.push({ emoji, count: 1, hasReacted: true });
                }

                broadcast({
                  type: 'CHAT_REACTION_UPDATED',
                  roomId,
                  messageId,
                  reactions: msg.reactions,
                });
              }
            }
            break;
          }

          case 'START_STREAM': {
            const { roomId, stream } = data;
            if (roomsState[roomId] && stream) {
              roomsState[roomId].activeStreams.set(stream.id, stream);

              // Atualiza flag no participante
              if (roomsState[roomId].participants.has(stream.participantId)) {
                const p = roomsState[roomId].participants.get(stream.participantId);
                p.isScreenSharing = true;
              }

              broadcast({
                type: 'STREAM_STARTED',
                roomId,
                stream,
              });
            }
            break;
          }

          case 'STOP_STREAM': {
            const { roomId, streamId, participantId } = data;
            if (roomsState[roomId]) {
              roomsState[roomId].activeStreams.delete(streamId);

              if (participantId && roomsState[roomId].participants.has(participantId)) {
                const p = roomsState[roomId].participants.get(participantId);
                p.isScreenSharing = false;
              }

              broadcast({
                type: 'STREAM_STOPPED',
                roomId,
                streamId,
                participantId,
              });
            }
            break;
          }

          case 'WEBRTC_SIGNAL': {
            const { targetUserId, signal, fromUserId } = data;
            const senderId = fromUserId || ws.userId;
            if (targetUserId && senderId) {
              sendToUser(targetUserId, {
                type: 'WEBRTC_SIGNAL',
                fromUserId: senderId,
                signal,
              });
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[LanSync] Erro ao processar mensagem do cliente:', err);
      }
    });

    ws.on('close', () => {
      // Quando a conexão WebSocket fecha (recarregar página F5 ou fechar janela)
      const { userId } = ws;
      if (userId) {
        // Aguarda carência de 8 segundos para permitir que F5 / recarregar reconecte sem perder a sala
        setTimeout(() => {
          let hasOtherSocket = false;
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN && client.userId === userId) {
              hasOtherSocket = true;
              break;
            }
          }

          if (!hasOtherSocket) {
            // Se após 8 segundos o usuário não reconectou nenhuma aba, remove das salas
            removeUserFromAllRooms(userId);
          }
        }, 8000);
      }
    });
  });

  // Limpeza Periódica Proativa (Heartbeat Ping/Pong + Remoção de Usuários e Streams Fantasmas)
  const cleanupInterval = setInterval(() => {
    // 1. Envia ping para verificar conexões ativas e encerra sockets travados
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        try { client.terminate(); } catch {}
        continue;
      }
      client.isAlive = false;
      try { client.ping(); } catch {}
    }

    // 2. Coleta todos os userIds com conexão WebSocket real e aberta
    const activeUserIds = new Set();
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN && client.userId) {
        activeUserIds.add(client.userId);
      }
    }

    // 3. Remove participantes que estão desconectados há mais de 10 segundos
    const now = Date.now();
    let anyGhostCleaned = false;
    LAN_ROOM_IDS.forEach(roomId => {
      // Verifica participantes fantasmas
      for (const [userId, participant] of roomsState[roomId].participants.entries()) {
        if (!activeUserIds.has(userId)) {
          if (!participant._disconnectedAt) {
            participant._disconnectedAt = now;
          } else if (now - participant._disconnectedAt > 10000) {
            console.log(`[LanSync] Removendo participante inativo há mais de 10s: ${participant.name} (${userId}) da sala ${roomId}`);
            const changed = removeUserFromRoom(roomId, userId, participant.name);
            if (changed) anyGhostCleaned = true;
          }
        } else {
          participant._disconnectedAt = null;
        }
      }

      // Verifica transmissões fantasmas (streamer sem conexão há mais de 10s ou fora da sala)
      for (const [sId, stream] of roomsState[roomId].activeStreams.entries()) {
        if (!roomsState[roomId].participants.has(stream.participantId)) {
          console.log(`[LanSync] Removendo transmissão fantasma ${stream.title} da sala ${roomId}`);
          roomsState[roomId].activeStreams.delete(sId);
          broadcast({
            type: 'STREAM_STOPPED',
            roomId,
            streamId: sId,
            participantId: stream.participantId,
          });
          anyGhostCleaned = true;
        }
      }
    });

    if (anyGhostCleaned) {
      broadcast({
        type: 'INIT_ROOMS_STATE',
        rooms: serializeRoomsState(),
      });
    }
  }, 4000);

  httpServer._lanSyncCleanupInterval = cleanupInterval;

  return wss;
}
