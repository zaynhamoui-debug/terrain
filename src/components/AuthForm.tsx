import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  mode: 'login' | 'register'
  onSubmit: (email: string, password: string) => Promise<string | null>
}

export default function AuthForm({ mode, onSubmit }: Props) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await onSubmit(email, password)
    if (err) setError(err)
    setLoading(false)
  }

  const isLogin = mode === 'login'

  return (
    <div className="min-h-screen bg-terrain-bg flex items-center justify-center px-4">
      {/* Subtle grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#f0ede8 1px, transparent 1px), linear-gradient(90deg, #f0ede8 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-terrain-text tracking-widest">TERRAIN</h1>
          <p className="text-terrain-muted text-xs mt-2 tracking-widest uppercase">
            Market Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="bg-terrain-surface border border-terrain-border rounded-lg p-8">
          <h2 className="font-display text-xl text-terrain-text mb-6">
            {isLogin ? 'Sign in' : 'Create account'}
          </h2>

          {error && (
            <div className="mb-5 px-4 py-3 rounded border border-red-800/60 bg-red-950/40 text-red-400 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-terrain-muted text-xs uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                className="w-full bg-terrain-bg border border-terrain-border rounded px-4 py-3 text-terrain-text text-sm font-mono focus:outline-none focus:border-terrain-gold transition-colors placeholder-terrain-muted"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-terrain-muted text-xs uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="w-full bg-terrain-bg border border-terrain-border rounded px-4 py-3 text-terrain-text text-sm font-mono focus:outline-none focus:border-terrain-gold transition-colors placeholder-terrain-muted"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded bg-terrain-gold text-terrain-bg text-xs font-bold tracking-widest uppercase hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
            >
              {loading ? '···' : isLogin ? 'Enter' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-terrain-muted text-xs mt-5">
          {isLogin ? "No account? " : "Have an account? "}
          <Link
            to={isLogin ? '/register' : '/login'}
            className="text-terrain-gold hover:underline"
          >
            {isLogin ? 'Register' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  )
}
