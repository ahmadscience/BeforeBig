import Image from "next/image";
import type { MediaItem } from "@/lib/media";

export function MediaImage({ item }: { item: Pick<MediaItem, "src" | "altText" | "width" | "height"> }) {
  // The gateway checks access on every request. Optimizer caching would bypass revocation.
  return <Image src={item.src} alt={item.altText} width={item.width} height={item.height} unoptimized className="media-image" />;
}
