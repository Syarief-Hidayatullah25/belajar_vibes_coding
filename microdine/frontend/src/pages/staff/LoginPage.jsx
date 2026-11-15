import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Alert } from '../../components/ui'

const HOME_BY_ROLE = {
  admin: '/staff/admin/dashboard',
  kasir: '/staff/queue',
  kitchen: '/staff/kitchen',
}

const DEMO = [
  { username: 'admin', role: 'Admin' },
  { username: 'kasir', role: 'Kasir' },
  { username: 'kitchen', role: 'Dapur' },
]

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={HOME_BY_ROLE[user.role] ?? '/staff/queue'} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const logged = await login(username.trim(), password)
      navigate(HOME_BY_ROLE[logged.role] ?? '/staff/queue', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <h1>MICRODINE</h1>
        <p className="muted small">Portal staf — kasir, dapur, dan admin.</p>

        {error && <Alert>{error}</Alert>}

        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span>Username</span>
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" className="button button--primary button--block" disabled={loading}>
            {loading ? 'Masuk…' : 'Masuk'}
          </button>
        </form>

        <div className="login__demo">
          <p className="muted small">Akun demo (password: password)</p>
          <div className="chips">
            {DEMO.map((account) => (
              <button
                key={account.username}
                type="button"
                className="chip"
                onClick={() => {
                  setUsername(account.username)
                  setPassword('password')
                }}
              >
                {account.role}: {account.username}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
