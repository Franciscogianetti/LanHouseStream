import React, { useState, useEffect } from 'react';
import { TabView } from '../types/stream';
import { APP_ASSETS } from '../data/mockData';
import { resolveAvatarUrl } from '../data/avatarOptions';
import { AvatarImage } from './AvatarImage';

interface HeaderProps {
  currentTab: TabView;
  onTabChange: (tab: TabView) => void;
  onShareInvite: () => void;
  onOpenProfileSettings?: () => void;
  roomName: string;
  streamQuality: string;
  isStreaming: boolean;
  participantCount: number;
  userProfileName?: string;
  userAvatar?: string;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  currentTab,
  onTabChange,
  onShareInvite,
  onOpenProfileSettings,
  roomName,
  streamQuality,
  isStreaming,
  participantCount,
  userProfileName,
  userAvatar,
}) => {
  const [ping, setPing] = useState(18);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userStatus, setUserStatus] = useState<'online' | 'busy' | 'away'>('online');
  const [notifications, setNotifications] = useState<{ id: number; text: string; time: string }[]>([]);

  // Subtle ping jitter to convey real-time network telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      setPing(prev => Math.min(22, Math.max(14, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-40 bg-[#0f1412]/85 backdrop-blur-xl border-b border-[#1f332a] shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
      <div className="h-16 w-full px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Brand & Telemetry */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div 
            onClick={() => onTabChange('stage')}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 overflow-hidden shadow-[0_0_15px_rgba(78,222,163,0.3)]">
              <img 
                alt="Lan House Stream Logo" 
                className="w-full h-full object-contain" 
                src={APP_ASSETS.logo}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo.svg';
                }}
              />
            </div>
            <span className="text-base font-bold text-[#dfe4e0] tracking-tight hidden sm:inline-block group-hover:text-[#4edea3] transition-colors">
              Lan House Stream
            </span>
          </div>

          <div className="h-4 w-px bg-[#262b29] hidden md:block"></div>

          {/* Room info and live stats */}
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded bg-[#262b29] text-[#4edea3] font-medium tracking-wide">
              {roomName || 'Sala 1'}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#181d1a] text-[#00e296] font-mono">
              Ping: {ping}ms
            </span>
            <span className="px-2 py-0.5 rounded bg-[#181d1a] text-[#bbcabf] font-mono">
              HD {streamQuality}
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#181d1a] text-[#bbcabf] font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-[#4edea3] animate-pulse' : 'bg-[#86948a]'}`}></span>
              <span>{participantCount} de 10</span>
            </div>
          </div>
        </div>

        {/* Center: Navigation tabs */}
        <nav className="flex items-center gap-1 bg-[#0a0f0d] p-1 rounded-lg border border-[#1f332a]">
          <button
            onClick={() => onTabChange('stage')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              currentTab === 'stage'
                ? 'bg-[#262b29] text-[#4edea3] shadow-sm'
                : 'text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#181d1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tv</span>
            <span>Palco</span>
          </button>



          <button
            onClick={() => onTabChange('settings')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              currentTab === 'settings'
                ? 'bg-[#262b29] text-[#4edea3] shadow-sm'
                : 'text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#181d1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
            <span>Configurações</span>
          </button>
        </nav>

        {/* Right: Actions & User Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onShareInvite}
            className="hidden sm:flex items-center justify-center h-8 px-3 rounded-lg bg-[#1c211e] text-[#bbcabf] hover:bg-[#262b29] hover:text-[#dfe4e0] border border-[#1f332a] transition-colors text-xs font-medium gap-1.5 active:scale-95"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">link</span>
            <span>Compartilhar Convite</span>
          </button>

          {/* Notifications button with popover */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-[#1c211e] text-[#bbcabf] hover:bg-[#262b29] hover:text-[#dfe4e0] border border-[#1f332a] transition-colors"
              type="button"
              title="Notificações"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#4edea3]"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#1c211e] border border-[#274237] shadow-[0_10px_35px_rgba(0,0,0,0.8)] p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[#262b29] mb-2">
                  <span className="text-xs font-semibold text-[#dfe4e0]">Notificações da Sala</span>
                  <button 
                    onClick={() => setNotifications([])} 
                    className="text-[11px] text-[#4edea3] hover:underline"
                  >
                    Limpar
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-[#86948a] py-3 text-center">Nenhuma nova notificação</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {notifications.map(n => (
                      <div key={n.id} className="p-2 rounded-lg bg-[#181d1a] border border-[#1f332a] text-xs">
                        <p className="text-[#dfe4e0] leading-snug">{n.text}</p>
                        <span className="text-[10px] text-[#86948a] mt-1 block">{n.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User profile picture with status dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="relative flex items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer"
              title="Perfil e Status"
              type="button"
            >
              <AvatarImage 
                alt="Profile" 
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#4edea3]/40 hover:ring-[#4edea3] transition-all bg-[#141916]" 
                src={userAvatar || APP_ASSETS.userProfile}
                fallbackText={userProfileName || 'Host'}
              />
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#0a0f0d] ${
                userStatus === 'online' ? 'bg-[#4edea3]' : userStatus === 'busy' ? 'bg-[#ffb4ab]' : 'bg-[#e2aa00]'
              }`}></span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#1c211e] border border-[#274237] shadow-[0_10px_35px_rgba(0,0,0,0.8)] p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col gap-1 text-xs">
                <div 
                  onClick={() => {
                    if (onOpenProfileSettings) onOpenProfileSettings();
                    setShowUserMenu(false);
                  }}
                  className="px-3 py-2 border-b border-[#262b29] flex items-center gap-2.5 cursor-pointer hover:bg-[#262b29] rounded-lg transition-colors"
                  title="Clique para editar seu perfil"
                >
                  <div className="relative">
                    <AvatarImage 
                      alt="Profile" 
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-[#4edea3]/50 bg-[#141916]" 
                      src={userAvatar || APP_ASSETS.userProfile}
                      fallbackText={userProfileName || 'Host'}
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-[#dfe4e0] truncate">{userProfileName || 'Host'}</span>
                    <span className="text-[10px] text-[#4edea3] font-mono">Editar Nome & Avatar</span>
                  </div>
                </div>

                {/* Status Switcher */}
                <div className="px-2 py-1">
                  <span className="text-[10px] text-[#86948a] uppercase font-bold tracking-wider">Status:</span>
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => setUserStatus('online')}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                        userStatus === 'online' ? 'bg-[#4edea3]/20 text-[#4edea3]' : 'text-[#86948a] hover:bg-[#262b29]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
                      <span>Online</span>
                    </button>
                    <button
                      onClick={() => setUserStatus('busy')}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                        userStatus === 'busy' ? 'bg-[#ffb4ab]/20 text-[#ffb4ab]' : 'text-[#86948a] hover:bg-[#262b29]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]"></span>
                      <span>Ocupado</span>
                    </button>
                    <button
                      onClick={() => setUserStatus('away')}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                        userStatus === 'away' ? 'bg-[#e2aa00]/20 text-[#e2aa00]' : 'text-[#86948a] hover:bg-[#262b29]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e2aa00]"></span>
                      <span>Ausente</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[#262b29] my-0.5"></div>

                {/* Opções de Configurações */}
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('settings');
                    setShowUserMenu(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#bbcabf] hover:text-[#4edea3] hover:bg-[#262b29] transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#4edea3]">settings</span>
                  <span>Painel de Hardware & Áudio</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onOpenProfileSettings) onOpenProfileSettings();
                    setShowUserMenu(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#bbcabf] hover:text-[#4edea3] hover:bg-[#262b29] transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#4edea3]">manage_accounts</span>
                  <span>Mudar Nome & Avatar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onShareInvite();
                    setShowUserMenu(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#262b29] transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#4edea3]">link</span>
                  <span>Copiar Convite da Sala</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
});
