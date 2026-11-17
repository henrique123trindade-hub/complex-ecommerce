import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  buildSrcSet,
  getImageVariant,
  resolveResponsiveSizes,
  shouldBypassProgressiveBlur,
  type ResponsiveSizesPreset,
} from '../utils/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  sizes?: ResponsiveSizesPreset | string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  onError?: () => void;
  onLoad?: () => void;
  disablePlaceholder?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  sizes = 'card',
  priority = false,
  className = 'w-full h-full',
  imgClassName = 'w-full h-full object-cover',
  style,
  referrerPolicy = 'no-referrer',
  onError,
  onLoad,
  disablePlaceholder = false,
}) => {
  const variant = useMemo(() => getImageVariant(src), [src]);
  const bypassBlur = disablePlaceholder || shouldBypassProgressiveBlur(src);
  const [loaded, setLoaded] = useState<boolean>(bypassBlur);
  const [errored, setErrored] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const webpSrcSet = useMemo(
    () => (variant ? buildSrcSet(variant.variants) : ''),
    [variant]
  );
  const resolvedSizes = useMemo(() => resolveResponsiveSizes(sizes), [sizes]);

  useEffect(() => {
    setErrored(false);
    setLoaded(bypassBlur);
  }, [src, bypassBlur]);

  useLayoutEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setErrored(true);
    setLoaded(true);
    onError?.();
  };

  const showPlaceholder = !loaded && !errored && !bypassBlur;
  const hasPositionClass = /\b(absolute|fixed|sticky)\b/.test(className);

  return (
    <div className={`${hasPositionClass ? '' : 'relative '}overflow-hidden bg-[#EAE6DF] ${className}`}>
      {showPlaceholder && (
        variant?.blurDataUrl ? (
          <img
            src={variant.blurDataUrl}
            alt=""
            aria-hidden="true"
            decoding="async"
            style={style}
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg pointer-events-none select-none"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[#E4DFD6] animate-pulse pointer-events-none"
          />
        )
      )}

      {variant ? (
        <picture className="block w-full h-full">
          <source type="image/webp" srcSet={webpSrcSet} sizes={resolvedSizes} />
          <img
            ref={imgRef}
            src={variant.fallbackSrc}
            alt={alt}
            width={variant.width}
            height={variant.height}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            fetchPriority={priority ? 'high' : 'auto'}
            referrerPolicy={referrerPolicy}
            onLoad={handleLoad}
            onError={handleError}
            style={style}
            className={`${imgClassName} transition-[opacity,filter,transform] duration-500 ease-out motion-reduce:transition-none ${
              loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm scale-[1.02]'
            }`}
          />
        </picture>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          referrerPolicy={referrerPolicy}
          onLoad={handleLoad}
          onError={handleError}
          style={style}
          className={`${imgClassName} transition-[opacity,filter,transform] duration-500 ease-out motion-reduce:transition-none ${
            loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm scale-[1.02]'
          }`}
        />
      )}
    </div>
  );
};
