import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AuthForm from '../components/AuthForm'

export default function Login() {
  const navigate = useNavigate()

  async function handleLogin(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    navigate('/app')
    return null
  }

  return <AuthForm mode="login" onSubmit={handleLogin} />
}
