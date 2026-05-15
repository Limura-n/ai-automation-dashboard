import { NextRequest, NextResponse } from 'next/server'

const STORE_API_URL = process.env.NEXT_PUBLIC_STORE_API_URL || 'http://localhost:8080/api'
const STORE_API_KEY = process.env.STORE_API_KEY || ''

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const searchParams = request.nextUrl.searchParams
  const pathStr = path.join('/')
  const queryStr = searchParams.toString()
  const url = `${STORE_API_URL}/${pathStr}${queryStr ? '?' + queryStr : ''}`

  try {
    const res = await fetch(url, {
      headers: {
        'X-API-Key': STORE_API_KEY,
        'Accept': 'application/json',
      },
      next: { revalidate: 30 },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to connect to store API', error: err?.message },
      { status: 502 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const body = await request.json()
  const pathStr = path.join('/')
  const url = `${STORE_API_URL}/${pathStr}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': STORE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to connect to store API', error: err?.message },
      { status: 502 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const body = await request.json()
  const pathStr = path.join('/')
  const url = `${STORE_API_URL}/${pathStr}`

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'X-API-Key': STORE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to connect to store API', error: err?.message },
      { status: 502 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathStr = path.join('/')
  const url = `${STORE_API_URL}/${pathStr}`

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-API-Key': STORE_API_KEY,
        'Accept': 'application/json',
      },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to connect to store API', error: err?.message },
      { status: 502 }
    )
  }
}
