import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AuthForm from '../components/AuthForm'

export default function Register() {
  const navigate = useNavigate()

  async function handleRegister(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) return error.message
    navigate('/app')
    return null
  }

  return <AuthForm mode="register" onSubmit={handleRegister} />
}
