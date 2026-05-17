import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const code = process.env.BUILDING_CODE
  if (!code || code === "change-me") {
    return NextResponse.json(
      { error: "BUILDING_CODE is not set. Add it to your .env file first." },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const url = `${appUrl}/register?code=${encodeURIComponent(code)}`

  return NextResponse.json({ url })
}
