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
  mobileSrc?: string;
  alt: string;
  sizes?: ResponsiveSizesPreset | string;
  priority?: boolean;
  eager?: boolean;
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
  mobileSrc,
  alt,
  sizes = 'card',
  priority = false,
  eager = false,
  className = 'w-full h-full',
  imgClassName = 'w-full h-full object-cover',
  style,
  referrerPolicy = 'no-referrer',
  onError,
  onLoad,
  disablePlaceholder = false,
}) => {
  const variant = useMemo(() => getImageVariant(src), [src]);
  const mobileVariant = useMemo(
    () => (mobileSrc ? getImageVariant(mobileSrc) : null),
    [mobileSrc]
  );

  const bypassBlur =
    disablePlaceholder || priority || eager || shouldBypassProgressiveBlur(src);
  const [loaded, setLoaded] = useState<boolean>(bypassBlur);
  const [errored, setErrored] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const avifSrcSet = useMemo(
    () => (variant?.avifVariants ? buildSrcSet(variant.avifVariants) : ''),
    [variant]
  );
  const webpSrcSet = useMemo(
    () => (variant ? buildSrcSet(variant.variants) : ''),
    [variant]
  );

  const mobileAvifSrcSet = useMemo(
    () => (mobileVariant?.avifVariants ? buildSrcSet(mobileVariant.avifVariants) : ''),
    [mobileVariant]
  );
  const mobileWebpSrcSet = useMemo(
    () => (mobileVariant ? buildSrcSet(mobileVariant.variants) : ''),
    [mobileVariant]
  );

  const resolvedSizes = useMemo(() => resolveResponsiveSizes(sizes), [sizes]);

  useEffect(() => {
    setErrored(false);
    setLoaded(bypassBlur);
  }, [src, mobileSrc, bypassBlur]);

  useLayoutEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src, mobileSrc]);

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

  const renderPlaceholder = () => {
    if (!showPlaceholder) return null;
    if (variant?.blurDataUrl) {
      return (
        <img
          src={variant.blurDataUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          style={style}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />
      );
    }
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#EAE6DF] pointer-events-none"
      />
    );
  };

  const imgClasses = bypassBlur
    ? imgClassName
    : `${imgClassName} transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        loaded ? 'opacity-100' : 'opacity-0'
      }`;

  return (
    <div className={`${hasPositionClass ? '' : 'relative '}overflow-hidden bg-[#EAE6DF] ${className}`}>
      {renderPlaceholder()}

      {variant ? (
        <picture className="block w-full h-full">
          {mobileVariant ? (
            <>
              {avifSrcSet && (
                <source
                  media="(min-width: 768px)"
                  type="image/avif"
                  srcSet={avifSrcSet}
                  sizes={resolvedSizes}
                />
              )}
              <source
                media="(min-width: 768px)"
                type="image/webp"
                srcSet={webpSrcSet}
                sizes={resolvedSizes}
              />
              {mobileAvifSrcSet && (
                <source
                  type="image/avif"
                  srcSet={mobileAvifSrcSet}
                  sizes={resolvedSizes}
                />
              )}
              <source
                type="image/webp"
                srcSet={mobileWebpSrcSet}
                sizes={resolvedSizes}
              />
            </>
          ) : (
            <>
              {avifSrcSet && (
                <source type="image/avif" srcSet={avifSrcSet} sizes={resolvedSizes} />
              )}
              <source type="image/webp" srcSet={webpSrcSet} sizes={resolvedSizes} />
            </>
          )}
          <img
            ref={imgRef}
            src={variant.fallbackSrc}
            alt={alt}
            width={variant.width}
            height={variant.height}
            loading={priority || eager ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            fetchPriority={priority ? 'high' : 'auto'}
            referrerPolicy={referrerPolicy}
            onLoad={handleLoad}
            onError={handleError}
            style={style}
            className={imgClasses}
          />
        </picture>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={priority || eager ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          referrerPolicy={referrerPolicy}
          onLoad={handleLoad}
          onError={handleError}
          style={style}
          className={imgClasses}
        />
      )}
    </div>
  );
};
