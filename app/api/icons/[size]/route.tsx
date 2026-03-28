import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(
  _request: NextRequest,
  { params }: { params: { size: string } }
) {
  const size = parseInt(params.size, 10)
  const validSizes = [192, 512]

  if (!validSizes.includes(size)) {
    return new Response("Invalid size. Use 192 or 512.", { status: 400 })
  }

  const fontSize = Math.round(size * 0.38)
  const subtitleSize = Math.round(size * 0.12)
  const borderRadius = Math.round(size * 0.17)
  const gap = Math.round(size * 0.02)

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#4F46E5",
          borderRadius: `${borderRadius}px`,
          gap: `${gap}px`,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: fontSize,
            fontWeight: 700,
            letterSpacing: "-4px",
            lineHeight: 1,
          }}
        >
          GS
        </span>
        <span
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: subtitleSize,
            fontWeight: 400,
          }}
        >
          Booking
        </span>
      </div>
    ),
    { width: size, height: size }
  )
}
