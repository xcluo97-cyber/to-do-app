import { getSupabaseClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseErrorStatus(message: string) {
  if (
    message.includes('Failed to resolve Clerk session token') ||
    message.includes('Missing Clerk JWT token for Supabase')
  ) {
    return 500
  }

  return 400
}

async function getAuthenticatedSupabaseClient() {
  const { userId } = await auth()

  if (!userId) {
    console.warn('[todos][auth] blocked: no Clerk userId')
    return null
  }

  console.info('[todos][auth] authenticated user', { userId })

  return {
    supabase: getSupabaseClient(),
    userId,
  }
}

// GET all todos
export async function GET() {
  try {
    console.info('[todos][GET] incoming request')
    const authContext = await getAuthenticatedSupabaseClient()

    if (!authContext) {
      console.warn('[todos][GET] returning 401 before Supabase call')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase, userId } = authContext
    console.info('[todos][GET] querying Supabase', { userId })

    const { data, error } = await supabase
      .from('todo')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[todos][GET] Supabase query failed', { message: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: getSupabaseErrorStatus(error.message) }
      )
    }

    console.info('[todos][GET] Supabase query succeeded', {
      userId,
      count: data?.length ?? 0,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[todos][GET] unexpected error', error)
    return NextResponse.json(
      { error: 'Failed to fetch todos' },
      { status: 500 }
    )
  }
}

// POST create a new todo
export async function POST(request: NextRequest) {
  try {
    console.info('[todos][POST] incoming request')
    const authContext = await getAuthenticatedSupabaseClient()

    if (!authContext) {
      console.warn('[todos][POST] returning 401 before Supabase call')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase, userId } = authContext

    const body = await request.json()
    const { title } = body

    if (!title) {
      console.warn('[todos][POST] validation failed: missing title')
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    console.info('[todos][POST] inserting todo in Supabase', { userId })

    const { data, error } = await supabase
      .from('todo')
      .insert([
        {
          title,
          completed: false,
          user_id: userId,
        },
      ])
      .select()

    if (error) {
      console.error('[todos][POST] Supabase insert failed', { message: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: getSupabaseErrorStatus(error.message) }
      )
    }

    console.info('[todos][POST] Supabase insert succeeded', {
      userId,
      id: data?.[0]?.id,
    })

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('[todos][POST] unexpected error', error)
    return NextResponse.json(
      { error: 'Failed to create todo' },
      { status: 500 }
    )
  }
}
