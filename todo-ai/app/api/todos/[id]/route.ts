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

interface Params {
  params: Promise<{
    id: string
  }>
}

async function getAuthenticatedSupabaseClient() {
  const { userId } = await auth()

  if (!userId) {
    console.warn('[todos:id][auth] blocked: no Clerk userId')
    return null
  }

  console.info('[todos:id][auth] authenticated user', { userId })

  return {
    supabase: getSupabaseClient(),
    userId,
  }
}

// GET a single todo
export async function GET(request: NextRequest, { params }: Params) {
  try {
    console.info('[todos:id][GET] incoming request')
    const { id } = await params
    const authContext = await getAuthenticatedSupabaseClient()

    if (!authContext) {
      console.warn('[todos:id][GET] returning 401 before Supabase call')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase, userId } = authContext
    console.info('[todos:id][GET] querying Supabase', { userId, id })

    const { data, error } = await supabase
      .from('todo')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[todos:id][GET] Supabase query failed', {
        id,
        message: error.message,
      })
      return NextResponse.json(
        { error: 'Todo not found' },
        { status: 404 }
      )
    }

    console.info('[todos:id][GET] Supabase query succeeded', { userId, id })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[todos:id][GET] unexpected error', error)
    return NextResponse.json(
      { error: 'Failed to fetch todo' },
      { status: 500 }
    )
  }
}

// PUT update a todo
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    console.info('[todos:id][PUT] incoming request')
    const { id } = await params
    const authContext = await getAuthenticatedSupabaseClient()

    if (!authContext) {
      console.warn('[todos:id][PUT] returning 401 before Supabase call')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase, userId } = authContext

    const body = await request.json()
    const { title, completed } = body

    console.info('[todos:id][PUT] updating todo in Supabase', {
      userId,
      id,
      hasTitle: title !== undefined,
      hasCompleted: completed !== undefined,
    })

    const { data, error } = await supabase
      .from('todo')
      .update({
        ...(title !== undefined && { title }),
        ...(completed !== undefined && { completed }),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()

    if (error) {
      console.error('[todos:id][PUT] Supabase update failed', {
        id,
        message: error.message,
      })
      return NextResponse.json(
        { error: error.message },
        { status: getSupabaseErrorStatus(error.message) }
      )
    }

    if (!data || data.length === 0) {
      console.warn('[todos:id][PUT] no row updated for user/id pair', { userId, id })
      return NextResponse.json(
        { error: 'Todo not found' },
        { status: 404 }
      )
    }

    console.info('[todos:id][PUT] Supabase update succeeded', { userId, id })

    return NextResponse.json(data[0])
  } catch (error) {
    console.error('[todos:id][PUT] unexpected error', error)
    return NextResponse.json(
      { error: 'Failed to update todo' },
      { status: 500 }
    )
  }
}

// DELETE a todo
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    console.info('[todos:id][DELETE] incoming request')
    const { id } = await params
    const authContext = await getAuthenticatedSupabaseClient()

    if (!authContext) {
      console.warn('[todos:id][DELETE] returning 401 before Supabase call')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase, userId } = authContext
    console.info('[todos:id][DELETE] deleting todo in Supabase', { userId, id })

    const { error } = await supabase
      .from('todo')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('[todos:id][DELETE] Supabase delete failed', {
        id,
        message: error.message,
      })
      return NextResponse.json(
        { error: error.message },
        { status: getSupabaseErrorStatus(error.message) }
      )
    }

    console.info('[todos:id][DELETE] Supabase delete succeeded', { userId, id })

    return NextResponse.json({ message: 'Todo deleted successfully' })
  } catch (error) {
    console.error('[todos:id][DELETE] unexpected error', error)
    return NextResponse.json(
      { error: 'Failed to delete todo' },
      { status: 500 }
    )
  }
}
