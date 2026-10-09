export interface LanRoom {
  id: string;
  shortName: string;
  fullName: string;
  isProtected?: boolean;
}

export const LAN_ROOMS: LanRoom[] = [
  { id: '#lan-house-transmissao-sala-1', shortName: 'Sala 1', fullName: 'Sala 1 - LAN House Transmissão', isProtected: true },
  { id: '#lan-house-transmissao-sala-2', shortName: 'Sala 2', fullName: 'Sala 2 - LAN House Transmissão' },
  { id: '#lan-house-transmissao-sala-3', shortName: 'Sala 3', fullName: 'Sala 3 - LAN House Transmissão' },
  { id: '#lan-house-transmissao-sala-4', shortName: 'Sala 4', fullName: 'Sala 4 - LAN House Transmissão' },
  { id: '#lan-house-transmissao-sala-5', shortName: 'Sala 5', fullName: 'Sala 5 - LAN House Transmissão' },
  { id: '#lan-house-transmissao-sala-6', shortName: 'Sala 6', fullName: 'Sala 6 - LAN House Transmissão' },
  { id: '#lan-house-transmissao-sala-7', shortName: 'Sala 7', fullName: 'Sala 7 - LAN House Transmissão' },
  { id: '#lan-house-transmissao-sala-8', shortName: 'Sala 8', fullName: 'Sala 8 - LAN House Transmissão' },
  { id: '#lan-house-transmissao-sala-9', shortName: 'Sala 9', fullName: 'Sala 9 - LAN House Transmissão' },
  { id: '#lan-house-transmissao-sala-10', shortName: 'Sala 10', fullName: 'Sala 10 - LAN House Transmissão' },
];

export const ROOM_OPTIONS = [
  { id: 'sala-1', channel: '#lan-house-transmissao-sala-1', label: 'Sala 1 (LAN House Transmissão) 🔒 Requer Senha', short: 'Sala 1', isProtected: true },
  { id: 'sala-2', channel: '#lan-house-transmissao-sala-2', label: 'Sala 2 (LAN House Transmissão)', short: 'Sala 2', isProtected: false },
  { id: 'sala-3', channel: '#lan-house-transmissao-sala-3', label: 'Sala 3 (LAN House Transmissão)', short: 'Sala 3', isProtected: false },
  { id: 'sala-4', channel: '#lan-house-transmissao-sala-4', label: 'Sala 4 (LAN House Transmissão)', short: 'Sala 4', isProtected: false },
  { id: 'sala-5', channel: '#lan-house-transmissao-sala-5', label: 'Sala 5 (LAN House Transmissão)', short: 'Sala 5', isProtected: false },
  { id: 'sala-6', channel: '#lan-house-transmissao-sala-6', label: 'Sala 6 (LAN House Transmissão)', short: 'Sala 6', isProtected: false },
  { id: 'sala-7', channel: '#lan-house-transmissao-sala-7', label: 'Sala 7 (LAN House Transmissão)', short: 'Sala 7', isProtected: false },
  { id: 'sala-8', channel: '#lan-house-transmissao-sala-8', label: 'Sala 8 (LAN House Transmissão)', short: 'Sala 8', isProtected: false },
  { id: 'sala-9', channel: '#lan-house-transmissao-sala-9', label: 'Sala 9 (LAN House Transmissão)', short: 'Sala 9', isProtected: false },
  { id: 'sala-10', channel: '#lan-house-transmissao-sala-10', label: 'Sala 10 (LAN House Transmissão)', short: 'Sala 10', isProtected: false },
];

export const STORAGE_DISCORD_USER_KEY = 'lanhouse_discord_user';
export const STORAGE_IS_IN_ROOM_KEY = 'lanhouse_is_in_room';
