import React, { useState, useEffect } from 'react';
import { resolveAvatarUrl } from '../data/avatarOptions';

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
  fallbackText?: string;
}

/**
 * Componente robusto de exibição de avatar com proteção tripla contra imagens quebradas:
 * 1. Tenta carregar o asset empacotado nativamente pelo Vite via resolveAvatarUrl.
 * 2. Em caso de falha de rede/caminho, tenta carregar via caminho alternativo relativo/público.
 * 3. Se nenhuma imagem carregar, renderiza um avatar estilizado com iniciais em SVG escuro/esmeralda.
 * Dessa forma, o ícone de imagem quebrada do navegador NUNCA é exibido para o usuário.
 */
export const AvatarImage: React.FC<AvatarImageProps> = React.memo(({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  fallbackText,
  onError,
  ...rest
}) => {
  // Níveis de tentativa: 0 = URL principal resolvida, 1 = fallback público, 2 = fallback SVG/iniciais
  const [attemptLevel, setAttemptLevel] = useState<number>(0);

  // Redefine o nível se o src mudar
  useEffect(() => {
    setAttemptLevel(0);
  }, [src]);

  // Se não houver src, vai direto para o fallback visual
  if (!src) {
    return renderFallback();
  }

  const primaryUrl = resolveAvatarUrl(src);

  // Se nível de erro chegou ao limite (ambas URLs falharam)
  if (attemptLevel >= 2) {
    return renderFallback();
  }

  // URL atual com base no nível de tentativa
  let currentSrc = primaryUrl;
  if (attemptLevel === 1) {
    // Tenta caminho direto da pasta public
    const clean = src.replace(/^\.?\/?avatars\//, '').replace(/^\//, '');
    currentSrc = `./avatars/${clean}`;
  }

  function renderFallback() {
    const initials = (fallbackText || alt || 'U')
      .trim()
      .slice(0, 2)
      .toUpperCase();

    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#1c2923] to-[#111814] text-[#4edea3] font-bold select-none ${className}`}
        title={alt}
      >
        <span className="text-[13px] tracking-wide">{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      onError={(e) => {
        if (attemptLevel === 0) {
          // Tenta o nível 1 (caminho público relativo)
          setAttemptLevel(1);
        } else {
          // Vai para o fallback SVG de iniciais
          setAttemptLevel(2);
        }
        if (onError) {
          onError(e);
        }
      }}
      {...rest}
    />
  );
});
