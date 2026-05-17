export default function FenceLayer({ weather }) {
  const night = weather === "night";

  return (
    <div
      className="relative z-10 flex h-full w-full flex-col justify-end px-[4%] pb-0"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="relative mx-auto w-full max-w-4xl"
        style={{ height: "clamp(52px, 12vh, 88px)" }}
      >
        <div
          className="absolute -top-8 left-[8%] h-10 w-[28%] rounded-t-[50%] opacity-60"
          style={{
            background: night ? "#1a3040" : "#5a9e6a",
            filter: "blur(1px)",
          }}
        />
        <div
          className="absolute -top-5 right-[12%] h-8 w-[22%] rounded-t-[50%] opacity-50"
          style={{ background: night ? "#152a38" : "#4d8f5c" }}
        />
        <div className="absolute bottom-0 flex h-full w-full items-end justify-center gap-[3px]">
          {Array.from({ length: 22 }).map((_, i) => (
            <div
              key={i}
              className="relative shrink-0 rounded-t-md border-2 border-[#2a2a28]/20"
              style={{
                width: "clamp(14px, 3.2vw, 22px)",
                height: `${68 + (i % 3) * 4}%`,
                background: "linear-gradient(180deg, #fafaf5 0%, #e8e6df 100%)",
                boxShadow: night
                  ? "inset 0 1px 0 rgba(255,255,255,0.5)"
                  : "inset 0 2px 0 #fff, 0 2px 4px rgba(0,0,0,0.08)",
              }}
            />
          ))}
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-3 rounded-sm border-2 border-[#2a2a28]/15"
          style={{
            background: "linear-gradient(180deg, #ebe9e2 0%, #d4d2cb 100%)",
          }}
        />
      </div>
    </div>
  );
}
