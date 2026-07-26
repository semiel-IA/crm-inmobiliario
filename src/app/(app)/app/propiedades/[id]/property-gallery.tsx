"use client";

import { useState } from "react";
import { ImageOff, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Read-only photo gallery for the property ficha (T1.8). `media` arrives ordered by `sortOrder`
 * with the cover moved first by the page. The seed URLs are placeholders that don't resolve, so
 * every image gets an `onError` fallback (elegant neutral tile with an icon) instead of the
 * browser's broken-image glyph. Upload/reorder is T1.9 — the "Agregar fotos" button is disabled
 * with a "próximamente" hint on purpose.
 */

export type GalleryMedia = {
  id: string;
  url: string;
  mediaType: string;
  isCover: boolean;
};

function GalleryImage({
  media,
  className,
  sizesHint,
}: {
  media: GalleryMedia;
  className?: string;
  sizesHint: "main" | "thumb";
}) {
  const [failed, setFailed] = useState(false);

  if (failed || media.mediaType !== "foto") {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground",
          className,
        )}
        role="img"
        aria-label="Foto no disponible"
      >
        <ImageOff className={sizesHint === "main" ? "size-8" : "size-4"} aria-hidden />
        {sizesHint === "main" && <span className="text-xs">Foto no disponible</span>}
      </div>
    );
  }

  // Plain <img>: remote placeholder URLs (seeds) aren't in the next/image allowlist and real
  // Storage URLs arrive with T1.9 — revisit next/image then.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.url}
      alt={media.isCover ? "Foto de portada de la propiedad" : "Foto de la propiedad"}
      loading={sizesHint === "main" ? "eager" : "lazy"}
      className={cn("h-full w-full object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}

export function PropertyGallery({ media }: { media: GalleryMedia[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = media[activeIndex];

  return (
    <section aria-label="Galería de fotos" className="flex flex-col gap-3">
      <div className="aspect-video w-full overflow-hidden rounded-xl ring-1 ring-foreground/10">
        {active ? (
          <GalleryImage key={active.id} media={active} sizesHint="main" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
            <ImageOff className="size-8" aria-hidden />
            <span className="text-sm">Esta propiedad aún no tiene fotos.</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {media.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`Ver foto ${index + 1}`}
            aria-current={index === activeIndex ? "true" : undefined}
            className={cn(
              "h-16 w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 transition-all",
              index === activeIndex
                ? "ring-2 ring-ring"
                : "ring-foreground/10 hover:ring-foreground/30",
            )}
          >
            <GalleryImage media={item} sizesHint="thumb" />
          </button>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          title="Próximamente (T1.9)"
          className="h-16 shrink-0 flex-col gap-1"
        >
          <ImagePlus />
          <span className="text-xs">Agregar fotos</span>
        </Button>
        <span className="text-xs text-muted-foreground">Próximamente</span>
      </div>
    </section>
  );
}
