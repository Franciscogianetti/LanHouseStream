export type TabView = 'stage' | 'grid' | 'recordings' | 'settings';

export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'spectator';
  avatar: string;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
}

export interface StreamSource {
  id: string;
  name: string;
  category: 'screens' | 'apps';
  resolution: string;
  fps: string;
  badge?: string;
  subtext: string;
  image: string;
  icon: string;
  gpuOrPipe?: string;
}

export interface ActiveStream {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  title: string;
  type: 'screen' | 'app';
  resolution: string;
  fps: string;
  mediaStream?: MediaStream | null;
  appIcon?: string;
  customColor?: string;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  hasReacted?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  senderRole?: string;
  text: string;
  time: string;
  reactions?: ChatReaction[];
  isSystem?: boolean;
  isStreamLog?: boolean;
}

export interface StreamPreset {
  id: string;
  name: string;
  quality: string;
  bitrate: string;
  fps: number;
  description: string;
}

export interface Recording {
  id: string;
  title: string;
  duration: string;
  date: string;
  fileSize: string;
  thumbnail: string;
  resolution: string;
  fps: string;
  codec: string;
}

export interface HardwareComponent {
  id: string;
  name: string;
  type: string;
}

export interface ScreenDevice {
  id: string;
  name: string;
  resolution: string;
  refreshRate: string;
  isPrimary: boolean;
}
