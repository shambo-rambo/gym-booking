import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#4F46E5",
          borderRadius: "32px",
          gap: 4,
        }}
      >
        <span style={{ color: "white", fontSize: 80, fontWeight: 700, letterSpacing: "-4px", lineHeight: 1 }}>
          GS
        </span>
        <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 22, fontWeight: 400, letterSpacing: "0px" }}>
          Booking
        </span>
      </div>
    ),
    { ...size }
  )
}
