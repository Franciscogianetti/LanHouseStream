import React, { useState } from 'react';
import { AVATAR_OPTIONS, AvatarOption, resolveAvatarUrl } from '../data/avatarOptions';
import { AvatarImage } from './AvatarImage';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentAvatar: string;
  discordOriginalAvatar?: string;
  onSaveProfile: (newName: string, newAvatar: string) => void;
  onShowToast: (msg: string, icon?: string) => void;
  onOpenHardwareSettings?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentName,
  currentAvatar,
  discordOriginalAvatar,
  onSaveProfile,
  onShowToast,
  onOpenHardwareSettings,
}) => {
  const [nameInput, setNameInput] = useState(currentName);
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'dbd_survivors', label: 'DBD Sobreviventes' },
    { id: 'dbd_killers', label: 'DBD Killers' },
    { id: 'diablo', label: 'Diablo' },
    { id: 'marvelrivals', label: 'Marvel Rivals' },
    { id: 'residentevil', label: 'Resident Evil' },
    { id: 'silenthill', label: 'Silent Hill' },
    { id: 'borderlands', label: 'Borderlands 3' },
    { id: 'overwatch', label: 'Overwatch' },
    { id: 'valorant', label: 'Valorant' },
    { id: 'eurotruck', label: 'Euro Truck' },
    { id: 'seaofthieves', label: 'Sea of Thieves' },
  ];

  const filteredAvatars = activeCategory === 'all'
    ? AVATAR_OPTIONS
    : AVATAR_OPTIONS.filter(a => a.category === activeCategory);

  const handleSave = () => {
    const trimmedName = nameInput.trim() || currentName || 'Usuário';
    onSaveProfile(trimmedName, selectedAvatar);
    onShowToast('Nome e avatar atualizados e salvos com sucesso!', 'badge');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#141916] border border-[#274237] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header do Modal */}
        <div className="px-5 py-4 border-b border-[#1f332a] flex items-center justify-between bg-[#181d1a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#262b29] border border-[#274237] flex items-center justify-center text-[#4edea3]">
              <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#dfe4e0]">Configurações de Perfil</h3>
              <p className="text-xs text-[#bbcabf]">Personalize seu nome e escolha seu avatar permanente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenHardwareSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHardwareSettings();
                }}
                className="px-3 py-1.5 rounded-xl bg-[#262b29] hover:bg-[#353a38] text-[#4edea3] text-xs font-semibold flex items-center gap-1.5 border border-[#1f332a] transition-colors cursor-pointer"
                title="Abrir painel de componentes de hardware e dispositivos do seu PC"
              >
                <span className="material-symbols-outlined text-[16px]">settings</span>
                <span className="hidden sm:inline">Configurações do PC</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[#262b29] hover:bg-[#353a38] text-[#bbcabf] hover:text-[#ffb4ab] flex items-center justify-center transition-colors cursor-pointer"
              title="Fechar"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Corpo com scroll */}
        <div className="p-5 overflow-y-auto flex flex-col gap-5 flex-1">
          
          {/* Card de Preview Atual e Edição de Nome */}
          <div className="p-4 rounded-2xl bg-[#1c211e] border border-[#1f332a] flex flex-col sm:flex-row items-center gap-4">
            {/* Foto Redonda em Destaque */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full border-3 border-[#4edea3] ring-4 ring-[#4edea3]/20 overflow-hidden shadow-[0_0_25px_rgba(78,222,163,0.3)] bg-black">
                <AvatarImage
                  src={selectedAvatar}
                  alt={nameInput}
                  fallbackText={nameInput}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#10b981] border-2 border-[#1c211e] flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[13px]">check</span>
              </span>
            </div>

            {/* Input de Nome */}
            <div className="flex-1 w-full flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#dfe4e0] flex items-center justify-between">
                <span>Seu Nome de Exibição na Sala:</span>
                <span className="text-[10px] font-mono text-[#86948a]">Ficará salvo no navegador</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="Digite seu nome"
                  maxLength={30}
                  className="w-full bg-[#0a0f0d] border border-[#274237] focus:border-[#4edea3] rounded-xl px-3.5 py-2.5 text-xs text-[#dfe4e0] font-semibold outline-none transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#86948a] font-mono pointer-events-none">
                  {nameInput.length}/30
                </span>
              </div>

              {/* Botão para Restaurar Foto Original do Discord */}
              {discordOriginalAvatar && (
                <button
                  type="button"
                  onClick={() => setSelectedAvatar(discordOriginalAvatar)}
                  className="self-start text-[11px] text-[#4edea3] hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">history</span>
                  <span>Usar foto original do meu Discord</span>
                </button>
              )}
            </div>
          </div>

          {/* Abas de Categorias de Avatares */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#dfe4e0]">
                Escolha seu Avatar (Formato Redondo):
              </label>
              <span className="text-[11px] font-mono text-[#4edea3]">
                {filteredAvatars.length} avatares disponíveis
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-[#4edea3] text-[#003824] shadow-[0_0_15px_rgba(78,222,163,0.3)]'
                      : 'bg-[#1c211e] text-[#bbcabf] hover:text-[#dfe4e0] hover:bg-[#262b29] border border-[#1f332a]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grade de Avatares Redondos Otimizada para Baixo Consumo de RAM */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto p-1">
            {filteredAvatars.map(avatar => {
              const isSelected = selectedAvatar === avatar.url || resolveAvatarUrl(selectedAvatar) === avatar.url;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '80px 80px' }}
                  onClick={() => setSelectedAvatar(avatar.url)}
                  className={`group flex flex-col items-center gap-2 p-2 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#262b29] border-[#4edea3] shadow-[0_0_20px_rgba(78,222,163,0.35)]'
                      : 'bg-[#181d1a] border-[#1f332a] hover:bg-[#1c211e] hover:border-[#274237]'
                  }`}
                >
                  {/* Foto Redonda */}
                  <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden transition-transform duration-200 group-hover:scale-105 bg-[#141916] ${
                    isSelected ? 'ring-3 ring-[#4edea3] ring-offset-2 ring-offset-[#181d1a]' : 'border border-[#1f332a]'
                  }`}>
                    <AvatarImage
                      src={avatar.url}
                      alt={avatar.name}
                      fallbackText={avatar.name}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#4edea3]/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#4edea3] text-[20px] font-bold">
                          check
                        </span>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-center font-medium text-[#bbcabf] group-hover:text-[#dfe4e0] line-clamp-1 w-full">
                    {avatar.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="px-5 py-3.5 border-t border-[#1f332a] flex items-center justify-between bg-[#181d1a]">
          <span className="text-[11px] text-[#86948a] hidden sm:inline">
            As alterações são salvas permanentemente no seu navegador.
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#262b29] hover:bg-[#353a38] text-[#bbcabf] hover:text-[#dfe4e0] text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-[#4edea3] hover:bg-[#00e296] text-[#003824] text-xs font-bold transition-all shadow-[0_0_20px_rgba(78,222,163,0.35)] cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
