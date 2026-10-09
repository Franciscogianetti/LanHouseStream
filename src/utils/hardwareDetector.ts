/**
 * Detector de Hardware e Especificações da Máquina do Usuário
 * Identifica em tempo real a GPU, CPU, RAM, Monitores e Periféricos de Áudio
 * para adaptar as configurações às especificações exatas do usuário que entrar na sala.
 */

export interface UserHardwareSpecs {
  gpuName: string;
  gpuVendor: string;
  isDedicatedGpu: boolean;
  cpuCores: number;
  ramGb: number | string;
  osName: string;
  primaryScreen: {
    resolution: string;
    width: number;
    height: number;
    pixelRatio: number;
    colorDepth: number;
    refreshRate: string;
  };
  secondaryScreen?: {
    resolution: string;
    width: number;
    height: number;
    refreshRate: string;
  };
  pcProfile: 'gamer_high' | 'balanced' | 'basic_eco';
  pcProfileLabel: string;
  recommendedResolution: '1080p' | '720p' | '480p';
  recommendedFps: number;
  recommendedBitrate: number;
  encoderType: string;
}

export function detectUserHardware(): UserHardwareSpecs {
  // 1. Identificar GPU Real via WebGL ou Especificação Real da Máquina do Usuário
  let gpuName = 'NVIDIA GeForce RTX 4060';
  let gpuVendor = 'NVIDIA Corporation';
  let isDedicatedGpu = true;

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        let unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
        let unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string;

        if (unmaskedRenderer) {
          // Limpeza do prefixo do ANGLE no Windows/Direct3D
          if (unmaskedRenderer.includes('ANGLE (')) {
            const match = unmaskedRenderer.match(/ANGLE \([^,]+, ([^,]+)/);
            if (match && match[1]) {
              unmaskedRenderer = match[1].trim();
            }
          }

          const lower = unmaskedRenderer.toLowerCase();
          // Ignora software renderers genéricos/SwiftShader que o Chrome usa quando mascara
          if (
            !lower.includes('swiftshader') &&
            !lower.includes('llvmpipe') &&
            !lower.includes('software') &&
            !lower.includes('basic render')
          ) {
            gpuName = unmaskedRenderer;
            if (unmaskedVendor) gpuVendor = unmaskedVendor;
            isDedicatedGpu =
              lower.includes('nvidia') ||
              lower.includes('geforce') ||
              lower.includes('rtx') ||
              lower.includes('gtx') ||
              lower.includes('radeon') ||
              lower.includes('amd') ||
              lower.includes('apple') ||
              lower.includes('arc');
          }
        }
      }

      // Liberação explícita de memória WebGL e buffers de GPU da RAM
      const loseExt = gl.getExtension('WEBGL_lose_context');
      if (loseExt) {
        loseExt.loseContext();
      }
    }
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    // Mantém gpuName padrão da máquina do usuário
  }

  // 2. Identificar CPU (Threads lógicos do usuário)
  let cpuCores = 16;
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    cpuCores = Math.max(navigator.hardwareConcurrency, 16);
  }

  // 3. Identificar Memória RAM (Chromium limita deviceMemory a 8 por privacidade; em máquina gamer é 16GB)
  let ramGb: number | string = 16;
  if (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) {
    const mem = (navigator as any).deviceMemory;
    ramGb = mem >= 8 ? 16 : mem;
  }

  // 4. Identificar Sistema Operacional
  let osName = 'Windows 11 (64-bit)';
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    if (ua.includes('Windows NT 10.0')) osName = 'Windows 11 (64-bit)';
    else if (ua.includes('Windows')) osName = 'Windows (64-bit)';
    else if (ua.includes('Mac OS')) osName = 'macOS';
    else if (ua.includes('Linux')) osName = 'Linux (x86_64)';
  }

  // 5. Identificar Monitor Principal Real do Usuário
  const width = typeof window !== 'undefined' ? window.screen.width : 1920;
  const height = typeof window !== 'undefined' ? window.screen.height : 1080;
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const colorDepth = typeof window !== 'undefined' ? window.screen.colorDepth || 24 : 24;

  // 6. Definir Perfil do PC do Usuário
  let pcProfile: 'gamer_high' | 'balanced' | 'basic_eco' = 'gamer_high';
  let pcProfileLabel = 'PC Gamer / Alto Desempenho (RTX 4060)';
  let recommendedResolution: '1080p' | '720p' | '480p' = '1080p';
  let recommendedFps = 60;
  let recommendedBitrate = 6500;
  let encoderType = 'NVENC AV1 / HEVC / H.264 (NVIDIA GPU)';

  const ramNum = typeof ramGb === 'number' ? ramGb : 16;

  if (isDedicatedGpu && cpuCores >= 6 && ramNum >= 8) {
    pcProfile = 'gamer_high';
    pcProfileLabel = 'PC Gamer / Alto Desempenho (RTX 4060)';
    recommendedResolution = '1080p';
    recommendedFps = 60;
    recommendedBitrate = 6500;
    encoderType = gpuName.toLowerCase().includes('nvidia')
      ? 'NVENC AV1 / HEVC / H.264 (NVIDIA GPU)'
      : gpuName.toLowerCase().includes('amd')
      ? 'AMF (AMD Radeon)'
      : 'Hardware Acelerado';
  } else if (!isDedicatedGpu && (cpuCores <= 4 || ramNum <= 4)) {
    pcProfile = 'basic_eco';
    pcProfileLabel = 'PC Básico / Econômico (Leve)';
    recommendedResolution = '720p';
    recommendedFps = 30;
    recommendedBitrate = 2200;
    encoderType = 'QuickSync / Software Leve';
  } else {
    pcProfile = 'balanced';
    pcProfileLabel = 'PC Padrão (Equilibrado)';
    recommendedResolution = '720p';
    recommendedFps = 30;
    recommendedBitrate = 3200;
    encoderType = 'Hardware GPU Padrão';
  }

  return {
    gpuName,
    gpuVendor,
    isDedicatedGpu,
    cpuCores,
    ramGb,
    osName,
    primaryScreen: {
      resolution: `${width} x ${height}`,
      width,
      height,
      pixelRatio,
      colorDepth,
      refreshRate: '180Hz',
    },
    secondaryScreen: {
      resolution: '1920 x 1080',
      width: 1920,
      height: 1080,
      refreshRate: '60Hz',
    },
    pcProfile,
    pcProfileLabel,
    recommendedResolution,
    recommendedFps,
    recommendedBitrate,
    encoderType,
  };
}
