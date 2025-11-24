import { createClient } from '@supabase/supabase-js'

// Aqui nós dizemos ao código: "Vá buscar as chaves no arquivo de ambiente"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)