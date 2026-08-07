/**
 * Fondo de malla degradada fijo para toda la app. Se monta una sola vez en el layout raíz y vive
 * detrás del contenido (`-z-10`), así que no participa del scroll ni se repinta por página.
 * `aria-hidden`: es decoración pura, no debe anunciarse a lectores de pantalla.
 */
export default function GradientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-32 h-[38rem] w-[38rem] rounded-full bg-[oklch(0.55_0.20_292/35%)] blur-[120px]" />
      <div className="absolute top-1/3 -right-40 h-[34rem] w-[34rem] rounded-full bg-[oklch(0.60_0.16_200/30%)] blur-[120px]" />
      <div className="absolute -bottom-48 left-1/4 h-[32rem] w-[32rem] rounded-full bg-[oklch(0.50_0.18_320/28%)] blur-[130px]" />
    </div>
  );
}
