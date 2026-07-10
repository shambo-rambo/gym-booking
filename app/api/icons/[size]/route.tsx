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

  const fontSize = Math.round(size * 0.5)
  const borderRadius = Math.round(size * 0.17)

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#192830",
          borderRadius: `${borderRadius}px`,
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
          W
        </span>
      </div>
    ),
    { width: size, height: size }
  )
}
