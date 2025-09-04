declare module 'next/image' {
  import * as React from 'react';

  type StaticImageData = any;

  interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string | StaticImageData;
    width?: number | string;
    height?: number | string;
    priority?: boolean;
    loading?: 'lazy' | 'eager';
    unoptimized?: boolean;
  }

  const Image: React.FC<ImageProps>;
  export default Image;
}
