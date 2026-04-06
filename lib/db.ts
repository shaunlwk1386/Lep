import { supabase } from './supabase'

export type Service = {
  id: string
  description: string
  amount: number
  payment: 'cash' | 'transfer'
}

export type DailyLog = {
  id: string
  date: string
  raw_text: string | null
  extracted_numbers: number[] | null
  services: Service[]
  total_amount: number
  cash_amount: number
  commission_rate: number
  image_log_url: string | null
  image_cash_url: string | null
  created_at: string
}

// Save a new log
export async function saveLog(data: {
  date: string
  raw_text?: string
  extracted_numbers?: number[]
  services: Service[]
  total_amount: number
  cash_amount: number
  commission_rate: number
  image_log_url?: string
  image_cash_url?: string
}) {
  const { error } = await supabase.from('daily_logs').insert([data])
  if (error) throw new Error(error.message)
}

// Update an existing log
export async function updateLog(id: string, data: {
  date: string
  services: Service[]
  total_amount: number
  cash_amount: number
  commission_rate: number
}) {
  const { error } = await supabase
    .from('daily_logs')
    .update(data)
    .eq('id', id)
  if (error) throw error
}

// Delete a log
export async function deleteLog(id: string) {
  const { error, data } = await supabase.from('daily_logs').delete().eq('id', id).select()
  console.log('[deleteLog] id:', id, '| deleted:', data, '| error:', error)
  if (error) throw error
}

// Get all logs ordered by date descending
export async function getLogs(): Promise<DailyLog[]> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Get a single log by id
export async function getLog(id: string): Promise<DailyLog | null> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

// Get logs for a date range
export async function getLogsByRange(from: string, to: string): Promise<DailyLog[]> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}
