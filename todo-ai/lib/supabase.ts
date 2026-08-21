import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient<any, 'public', any> | null = null

function formatTokenResolutionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return new Error(`Failed to resolve Clerk session token: ${message}`)
}

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set in your environment.'
    )
  }

  if (!supabaseClient) {
    console.info('[supabase] creating global server client')
    supabaseClient = createClient<any>(supabaseUrl, supabasePublishableKey, {
      global: {
        fetch: async (url, options = {}) => {
          const requestOptions = options as RequestInit
          const headers = new Headers(requestOptions.headers)

          console.info('[supabase] resolving Clerk access token')
          const { userId, getToken } = await auth()

          if (!userId) {
            console.warn('[supabase] token resolution failed: no Clerk userId')
            throw new Error('Unauthorized')
          }

          console.info('[supabase] requesting default Clerk session token', { userId })
          let token: string | null = null

          try {
            token = await getToken()
          } catch (error) {
            throw formatTokenResolutionError(error)
          }

          if (!token) {
            console.warn('[supabase] token resolution failed: missing Clerk JWT token')
            throw new Error('Missing Clerk JWT token for Supabase')
          }

          headers.set('Authorization', `Bearer ${token}`)
          console.info('[supabase] Clerk token resolved')

          return fetch(url, {
            ...requestOptions,
            headers,
          })
        },
      },
    })
  }

  return supabaseClient
}
