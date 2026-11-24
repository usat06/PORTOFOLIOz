import type { ImgHTMLAttributes, VideoHTMLAttributes } from 'react';
import { useCloudMediaUrl } from '../services/portfolioStore';

export function CloudImg({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const resolvedSrc = useCloudMediaUrl(src);
  return <img src={resolvedSrc} {...props} />;
}

export function CloudVideo({ src, ...props }: VideoHTMLAttributes<HTMLVideoElement>) {
  const resolvedSrc = useCloudMediaUrl(src);
  return <video src={resolvedSrc} {...props} />;
}
