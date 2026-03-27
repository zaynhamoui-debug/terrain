import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login        from './pages/Login'
import Register     from './pages/Register'
import AppPage      from './pages/App'
import SharedMap    from './pages/SharedMap'
import SegmentPage  from './pages/SegmentPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authed,  setAuthed]  = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthed(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-terrain-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-terrain-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return authed ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/app"        element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
        <Route path="/share/:id"  element={<SharedMap />} />
        <Route path="/segment"    element={<ProtectedRoute><SegmentPage /></ProtectedRoute>} />
        <Route path="/"           element={<Navigate to="/app" replace />} />
        <Route path="*"           element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
