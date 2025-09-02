import React, { useState } from 'react'
import axios from 'axios'

export default function Login() {
  const [username, setUsername] = useState('demo')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await axios.post('/api/auth/login', { username, password }, { withCredentials: true })
      localStorage.setItem('token', res.data.token)
      window.location.href = '/app'
    } catch (err) {
      setError(err?.response?.data?.message || '로그인 실패')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6">Select Zone</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-600 mb-1">아이디 (id)</label>
            <input className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring"
                   value={username} onChange={e=>setUsername(e.target.value)} placeholder="id" />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">암 호 (pw)</label>
            <input type="password" className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring"
                   value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button type="submit" className="w-full bg-gray-500 text-white py-3 rounded-md font-semibold hover:opacity-90">
            LOGIN
          </button>
          <p className="text-xs text-gray-400 text-center">기본 계정: demo / demo1234</p>
        </form>
      </div>
    </div>
  )
}
