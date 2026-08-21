import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface Params {
  params: {
    id: string
  }
}

// GET a single todo
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = params

    const { data, error } = await supabase
      .from('todo')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Todo not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch todo' },
      { status: 500 }
    )
  }
}

// PUT update a todo
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = params
    const body = await request.json()
    const { title, completed } = body

    const { data, error } = await supabase
      .from('todo')
      .update({
        ...(title !== undefined && { title }),
        ...(completed !== undefined && { completed }),
      })
      .eq('id', id)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Todo not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update todo' },
      { status: 500 }
    )
  }
}

// DELETE a todo
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = params

    const { error } = await supabase.from('todo').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Todo deleted successfully' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete todo' },
      { status: 500 }
    )
  }
}
