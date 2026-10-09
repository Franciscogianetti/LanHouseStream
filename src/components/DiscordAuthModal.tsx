import React, { useState, useEffect } from 'react';

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
}

import { ROOM_OPTIONS, STORAGE_DISCORD_USER_KEY } from '../constants/lanRooms';

interface DiscordAuthModalProps {
  onSuccessLogin: (user: DiscordUser, selectedChannel?: string) => void;
}

// Client ID da aplicação Lan House Stream do usuário (1556867211463892994)
const DISCORD_CLIENT_ID = '1556867211463892994';

export const DiscordAuthModal: React.FC<DiscordAuthModalProps> = ({ onSuccessLogin }) => {
  // Carrega credenciais do usuário salvas no navegador (autorizado no primeiro acesso)
  const getStoredUser = (): DiscordUser | null => {
    try {
      if (typeof window !== 'undefined') {
        const item = localStorage.getItem(STORAGE_DISCORD_USER_KEY);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed && (parsed.username || parsed.id)) {
            return parsed;
          }
        }
      }
    } catch {
      // Ignora erro
    }
    return null;
  };

  const getOrCreateDeviceId = (): string => {
    try {
      if (typeof window !== 'undefined') {
        let id = localStorage.getItem('lanhouse_device_user_id');
        if (!id) {
          id = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
          localStorage.setItem('lanhouse_device_user_id', id);
        }
        return id;
      }
    } catch {}
    return `user-${Date.now().toString(36)}`;
  };

  const storedUser = getStoredUser();

  // Se já foi autorizado anteriormente no navegador, vai direto para a escolha da sala!
  const [step, setStep] = useState<'prompt' | 'authorizing' | 'authenticated'>(
    storedUser ? 'authenticated' : 'prompt'
  );
  const [selectedRoomId, setSelectedRoomId] = useState('sala-1');
  const [sala1Password, setSala1Password] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [discordUsername, setDiscordUsername] = useState(storedUser?.username || '');
  const [discordTag, setDiscordTag] = useState(storedUser?.discriminator || '0');
  const [userAvatar, setUserAvatar] = useState(
    storedUser?.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'
  );
  const [userId, setUserId] = useState(
    storedUser && storedUser.id && storedUser.id !== 'discord-user-1'
      ? storedUser.id
      : ''
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user && (user.username || user.id)) {
      setDiscordUsername(user.username || '');
      setDiscordTag(user.discriminator || '0');
      setUserAvatar(user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png');
      if (user.id && user.id !== 'discord-user-1') {
        setUserId(user.id);
      }
      setStep('authenticated');
    }
  }, []);

  // URL oficial de autorização da aplicação Lan House Stream no Discord com redirect_uri salvo
  const redirectUri = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const discordOAuthUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify`;

  // Processa o token e busca o perfil na API do Discord
  const processToken = (token: string) => {
    setIsLoadingProfile(true);
    fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (data && (data.username || data.global_name)) {
          const avatar = data.avatar
            ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${Number(data.discriminator || 0) % 5}.png`;

          const user: DiscordUser = {
            id: data.id,
            username: data.global_name || data.username,
            discriminator: data.discriminator && data.discriminator !== '0' ? data.discriminator : '0',
            avatar,
          };

          // Salva os dados permanentemente no navegador para não precisar autorizar de novo
          try {
            localStorage.setItem(STORAGE_DISCORD_USER_KEY, JSON.stringify(user));
          } catch {}

          setUserId(user.id);
          setDiscordUsername(user.username);
          setDiscordTag(user.discriminator);
          setUserAvatar(avatar);
          setStep('authenticated');
          setIsLoadingProfile(false);
        } else {
          setIsLoadingProfile(false);
        }
      })
      .catch(err => {
        console.warn('Erro ao buscar perfil do Discord:', err);
        setIsLoadingProfile(false);
      });
  };

  // Se esta janela for o popup de retorno, avisa a janela principal e fecha
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'DISCORD_TOKEN', token }, '*');
            window.close();
            return;
          } catch {
            // Ignora se bloqueado
          }
        }
        window.history.replaceState(null, '', window.location.pathname);
        processToken(token);
      }
    }
  }, []);

  // Listener para mensagens vindas da janela popup
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'DISCORD_TOKEN' && e.data.token) {
        processToken(e.data.token);
      } else if (e.data?.type === 'DISCORD_TOKEN_HASH' && e.data.hash) {
        const params = new URLSearchParams(e.data.hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          processToken(token);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Abre a janela de Popup centralizada com a tela oficial do Discord
  const handleOpenPopup = () => {
    const width = 500;
    const height = 760;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    const popup = window.open(
      discordOAuthUrl,
      'DiscordAuthPopup',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=no,toolbar=no,menubar=no`
    );

    setStep('authorizing');

    // Monitora o popup para capturar o retorno do token e fechar instantaneamente
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setStep('authenticated');
          return;
        }

        try {
          if (popup.location && popup.location.href.includes('access_token=')) {
            const hash = popup.location.hash;
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get('access_token');
            if (token) {
              clearInterval(timer);
              try {
                popup.close();
              } catch {}
              processToken(token);
            }
          }
        } catch {
          // Cross-origin antes de redirecionar para localhost é esperado, ignora
        }
      }, 200);
    }
  };

  const handleAuthorizeManual = () => {
    const manualUser: DiscordUser = {
      id: userId || getOrCreateDeviceId(),
      username: discordUsername,
      discriminator: discordTag,
      avatar: userAvatar,
    };
    try {
      localStorage.setItem(STORAGE_DISCORD_USER_KEY, JSON.stringify(manualUser));
    } catch {}
    setStep('authenticated');
  };

  // Entrar diretamente na sala selecionada
  const handleEnterRoom = () => {
    const selected = ROOM_OPTIONS.find(r => r.id === selectedRoomId) || ROOM_OPTIONS[0];

    // Sala 1 exige a senha "lanhouse"
    if (selected.id === 'sala-1' && sala1Password.trim() !== 'lanhouse') {
      setPasswordError(true);
      return;
    }

    const userToEnter: DiscordUser = {
      id: userId || getOrCreateDeviceId(),
      username: discordUsername,
      discriminator: discordTag,
      avatar: userAvatar,
    };

    // Garante que os dados ficam armazenados no navegador
    try {
      localStorage.setItem(STORAGE_DISCORD_USER_KEY, JSON.stringify(userToEnter));
    } catch {}

    onSuccessLogin(userToEnter, selected.channel);
  };

  // Trocar de conta (limpa o cache do navegador e abre a tela de autorização)
  const handleSwitchAccount = () => {
    try {
      localStorage.removeItem(STORAGE_DISCORD_USER_KEY);
    } catch {}
    setStep('prompt');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0f0d] overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-[#5865f2]/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-1/3 w-[300px] h-[300px] bg-[#10b981]/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#181d1a] border border-[#274237] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden relative flex flex-col items-center p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* Loading de perfil do Discord */}
        {isLoadingProfile && (
          <div className="flex flex-col items-center py-8">
            <div className="w-12 h-12 rounded-full border-4 border-[#5865f2] border-t-transparent animate-spin mb-4"></div>
            <p className="text-sm font-semibold text-[#dfe4e0]">Autenticando com o Discord...</p>
            <p className="text-xs text-[#86948a] mt-1">Carregando seu perfil e foto</p>
          </div>
        )}

        {/* Step 1: Prompt Inicial (Apenas no Primeiro Acesso) */}
        {!isLoadingProfile && step === 'prompt' && (
          <div className="flex flex-col items-center w-full">
            <div className="w-16 h-16 rounded-2xl bg-[#5865f2]/15 border border-[#5865f2]/40 flex items-center justify-center text-[#5865f2] mb-4 shadow-[0_0_25px_rgba(88,101,242,0.3)]">
              <svg className="w-9 h-9 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>

            <span className="px-3 py-1 rounded-full bg-[#10b981]/15 text-[#4edea3] font-mono text-[11px] font-bold tracking-wider mb-2 border border-[#4edea3]/30">
              PRIMEIRO ACESSO • LAN HOUSE STREAM
            </span>

            <h2 className="text-xl sm:text-2xl font-bold text-[#dfe4e0] tracking-tight mb-2">
              Autorização do Discord
            </h2>

            <p className="text-xs sm:text-sm text-[#bbcabf] mb-6 leading-relaxed">
              Você autoriza apenas uma vez no seu primeiro acesso. Seus dados ficarão armazenados no navegador e nos próximos acessos você entrará direto escolhendo a sala!
            </p>

            {/* Botão que abre a janela de Popup centralizada */}
            <button
              type="button"
              onClick={handleOpenPopup}
              className="w-full py-3.5 px-4 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] text-white font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-[0_0_25px_rgba(88,101,242,0.4)] hover:shadow-[0_0_35px_rgba(88,101,242,0.6)] cursor-pointer active:scale-95"
            >
              <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>Autorizar com o Discord</span>
            </button>
          </div>
        )}

        {/* Step 2: Tela enquanto o Popup está aberto */}
        {!isLoadingProfile && step === 'authorizing' && (
          <div className="flex flex-col items-center w-full animate-in fade-in duration-150">
            <div className="relative mb-3">
              <div className="p-3.5 rounded-2xl bg-[#5865f2] text-white shadow-[0_0_25px_rgba(88,101,242,0.4)] animate-pulse">
                <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#4edea3] ring-2 ring-[#181d1a] animate-ping"></span>
            </div>

            <h3 className="text-lg font-bold text-[#dfe4e0] mb-1">Janela de Autorização Aberta</h3>
            <p className="text-xs text-[#bbcabf] mb-4">
              Clique em <strong>Autorizar</strong> na janela do Discord. Os dados serão salvos no navegador para você nunca mais ter que autorizar!
            </p>

            <button
              type="button"
              onClick={handleOpenPopup}
              className="w-full py-2.5 px-3 rounded-xl bg-[#262b29] hover:bg-[#353a38] text-[#dfe4e0] border border-[#1f332a] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer mb-4"
            >
              <span className="material-symbols-outlined text-[16px] text-[#5865f2]">open_in_new</span>
              <span>Reabrir Janela do Discord</span>
            </button>

            {/* Confirmação de Usuário e Tag do Discord */}
            <div className="w-full flex flex-col gap-2 mb-4 text-left bg-[#1c211e] p-3 rounded-xl border border-[#1f332a]">
              <label className="text-xs font-semibold text-[#bbcabf]">Sua conta autorizada:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={discordUsername}
                  onChange={e => setDiscordUsername(e.target.value)}
                  placeholder="Nome no Discord"
                  className="flex-1 bg-[#0a0f0d] border border-[#1f332a] focus:border-[#5865f2] rounded-xl px-3 py-2 text-xs text-[#dfe4e0] outline-none"
                />
                <span className="text-[#86948a] font-mono text-xs">#</span>
                <input
                  type="text"
                  value={discordTag}
                  onChange={e => setDiscordTag(e.target.value)}
                  maxLength={4}
                  className="w-16 bg-[#0a0f0d] border border-[#1f332a] focus:border-[#5865f2] rounded-xl px-2 py-2 text-xs text-[#dfe4e0] font-mono outline-none text-center"
                />
              </div>
            </div>

            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('prompt')}
                className="flex-1 py-2.5 rounded-xl bg-[#1c211e] hover:bg-[#262b29] text-[#bbcabf] font-semibold text-xs transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleAuthorizeManual}
                className="flex-1 py-2.5 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] text-white font-bold text-xs transition-all shadow-[0_0_20px_rgba(88,101,242,0.4)] cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Salvar e Prosseguir</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Autenticado - ENTRADA DIRETA PARA ESCOLHER A SALA (SEM PRECISAR AUTORIZAR DE NOVO) */}
        {!isLoadingProfile && step === 'authenticated' && (
          <div className="flex flex-col items-center w-full animate-in fade-in zoom-in-95 duration-150">
            {/* Foto e Perfil Autorizado */}
            <div className="relative mb-3">
              <div className="w-18 h-18 rounded-full bg-[#5865f2] border-2 border-[#4edea3] overflow-hidden flex items-center justify-center font-bold text-2xl text-white shadow-[0_0_25px_rgba(78,222,163,0.35)]">
                {userAvatar && !userAvatar.includes('embed/avatars') ? (
                  <img src={userAvatar} alt={discordUsername} className="w-full h-full object-cover" />
                ) : (
                  discordUsername.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#10b981] border-2 border-[#181d1a] flex items-center justify-center text-white text-[13px] shadow-sm">
                <span className="material-symbols-outlined text-[14px]">check</span>
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-[#dfe4e0] mb-0.5">
              {discordUsername}
              {discordTag !== '0' && <span className="text-[#86948a] font-normal text-sm">#{discordTag}</span>}
            </h3>

            {/* Aviso de Conta Salva no Navegador */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10b981]/15 border border-[#4edea3]/30 text-[#4edea3] text-[11px] font-mono font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span>Conta Salva no Navegador • Conectado</span>
            </div>

            <p className="text-xs text-[#bbcabf] mb-4">
              Seu acesso já está autorizado. Selecione a sala desejada para entrar diretamente:
            </p>

            {/* Seletor de Sala (Sala 1 a Sala 10) */}
            <div className="w-full flex flex-col gap-1.5 mb-3 text-left">
              <label className="text-xs font-semibold text-[#dfe4e0] flex items-center justify-between">
                <span>Escolher Sala:</span>
                <span className="text-[10px] text-[#4edea3] font-mono">10 Salas Disponíveis</span>
              </label>
              <div className="relative">
                <select
                  value={selectedRoomId}
                  onChange={e => {
                    setSelectedRoomId(e.target.value);
                    setPasswordError(false);
                  }}
                  className="w-full appearance-none bg-[#101513] border border-[#274237] focus:border-[#4edea3] rounded-xl px-4 py-3.5 text-xs text-[#dfe4e0] font-bold outline-none cursor-pointer pr-10 transition-colors shadow-inner"
                >
                  {ROOM_OPTIONS.map(room => (
                    <option key={room.id} value={room.id} className="bg-[#181d1a] text-[#dfe4e0]">
                      {room.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#4edea3] flex items-center">
                  <span className="material-symbols-outlined text-[22px]">expand_more</span>
                </div>
              </div>
            </div>

            {/* Campo de Senha da Sala 1 */}
            {selectedRoomId === 'sala-1' && (
              <div className="w-full flex flex-col gap-1.5 mb-4 text-left animate-in fade-in duration-150">
                <label className="text-xs font-semibold text-[#dfe4e0] flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[#4edea3]">
                    <span className="material-symbols-outlined text-[15px]">lock</span>
                    <span>Senha de Acesso da Sala 1:</span>
                  </span>
                  <span className="text-[10px] text-[#ffb4ab] font-mono">Requerida (lanhouse)</span>
                </label>
                <input
                  type="password"
                  value={sala1Password}
                  onChange={e => {
                    setSala1Password(e.target.value);
                    if (passwordError) setPasswordError(false);
                  }}
                  placeholder="Digite a senha (lanhouse)"
                  className={`w-full bg-[#101513] border rounded-xl px-4 py-3 text-xs text-[#dfe4e0] outline-none font-mono transition-colors ${
                    passwordError
                      ? 'border-[#ffb4ab] focus:border-[#ffb4ab] ring-1 ring-[#ffb4ab]'
                      : 'border-[#274237] focus:border-[#4edea3]'
                  }`}
                />
                {passwordError && (
                  <span className="text-[11px] text-[#ffb4ab] font-semibold flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>Senha incorreta! Digite a senha: <strong>lanhouse</strong></span>
                  </span>
                )}
              </div>
            )}

            {/* Botão Principal: Entrar Direto na Sala */}
            <button
              type="button"
              onClick={handleEnterRoom}
              className="w-full py-3.5 px-4 rounded-xl bg-[#4edea3] hover:bg-[#00e296] text-[#003824] font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-[0_0_25px_rgba(78,222,163,0.4)] hover:shadow-[0_0_35px_rgba(78,222,163,0.6)] cursor-pointer active:scale-95 mb-3"
            >
              <span className="material-symbols-outlined text-[20px]">meeting_room</span>
              <span>Entrar na {ROOM_OPTIONS.find(r => r.id === selectedRoomId)?.short || 'Sala 1'} (LAN House Transmissão)</span>
            </button>

            {/* Opção para trocar de conta do Discord */}
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="text-xs text-[#86948a] hover:text-[#bbcabf] hover:underline flex items-center gap-1 transition-colors cursor-pointer pt-1"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              <span>Trocar de conta do Discord</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
