export function FridayEmblem({ size = 32 }: { size?: number }) {
  return (
    <div
      className="rounded-full border border-[#28CFFF]/40 bg-[#28CFFF]/10 shadow-[0_0_20px_rgba(40,207,255,0.35)] flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="rounded-full border border-[#8BDFFF]/60"
        style={{ width: size * 0.45, height: size * 0.45 }}
      />
    </div>
  )
}
