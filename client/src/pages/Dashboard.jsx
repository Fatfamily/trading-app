import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'

function TopBar({ onLogout }) {
  return (
    <div className="h-12 bg-slate-800 text-white flex items-center justify-between px-4">
      <div className="font-bold">KIWOOM 스타일 트레이더</div>
      <div className="flex items-center gap-4">
        <span className="text-sm opacity-80">가상잔고: 100,000,000원</span>
        <button onClick={onLogout} className="bg-slate-600 rounded px-3 py-1">로그아웃</button>
      </div>
    </div>
  )
}

function Watchlist({ symbols, selected, onSelect }) {
  return (
    <div className="bg-white rounded-xl shadow p-2 h-full overflow-auto">
      <div className="font-semibold mb-2">관심종목</div>
      {symbols.map((q) => (
        <div key={q.symbol}
             onClick={() => onSelect(q.symbol)}
             className={
               'flex justify-between px-2 py-1 rounded cursor-pointer ' +
               (selected === q.symbol ? 'bg-slate-100' : 'hover:bg-slate-50')
             }>
          <span>{q.symbol}</span>
          <span>{q.price.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function Orders({ onPlace, orders }) {
  const [symbol, setSymbol] = useState('005930')
  const [side, setSide] = useState('buy')
  const [price, setPrice] = useState('100000')
  const [qty, setQty] = useState('10')

  return (
    <div className="bg-white rounded-xl shadow p-3">
      <div className="font-semibold mb-3">주문</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">종목코드</label>
        <input className="border rounded px-2 py-1" value={symbol} onChange={e=>setSymbol(e.target.value)} />
        <label className="text-sm">매수/매도</label>
        <select className="border rounded px-2 py-1" value={side} onChange={e=>setSide(e.target.value)}>
          <option value="buy">매수</option>
          <option value="sell">매도</option>
        </select>
        <label className="text-sm">가격</label>
        <input className="border rounded px-2 py-1" value={price} onChange={e=>setPrice(e.target.value)} />
        <label className="text-sm">수량</label>
        <input className="border rounded px-2 py-1" value={qty} onChange={e=>setQty(e.target.value)} />
      </div>
      <button onClick={() => onPlace({ symbol, side, price: Number(price), qty: Number(qty) })}
              className="mt-3 w-full bg-slate-700 text-white py-2 rounded">주문하기</button>

      <div className="mt-4">
        <div className="font-semibold mb-2">체결내역</div>
        <div className="h-48 overflow-auto border rounded">
          {orders.map(o => (
            <div key={o.id} className="flex justify-between text-sm px-2 py-1 border-b">
              <span>{o.symbol}</span>
              <span>{o.side}</span>
              <span>{o.price.toLocaleString()}</span>
              <span>{o.qty}</span>
              <span>{new Date(o.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChartPanel({ symbol, priceHistory }) {
  // Simple sparkline using SVG
  const points = useMemo(() => {
    if (!priceHistory.length) return ''
    const w = 500, h = 200
    const prices = priceHistory.map(p => p.price)
    const minP = Math.min(...prices), maxP = Math.max(...prices)
    const norm = (p) => (h - (p - minP) / Math.max(1, (maxP - minP)) * h)
    const stepX = w / Math.max(1, priceHistory.length - 1)
    return priceHistory.map((p, i) => `${i*stepX},${norm(p.price)}`).join(' ')
  }, [priceHistory])

  const last = priceHistory[priceHistory.length - 1]

  return (
    <div className="bg-white rounded-xl shadow p-3 h-full">
      <div className="flex justify-between items-center">
        <div className="font-semibold">차트: {symbol}</div>
        <div className="text-sm">현재가: {last ? last.price.toLocaleString() : '-'}</div>
      </div>
      <div className="mt-2 border rounded p-2 h-[220px]">
        <svg width="100%" height="200" viewBox="0 0 500 200" preserveAspectRatio="none">
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [quotes, setQuotes] = useState([])
  const [selected, setSelected] = useState('005930')
  const [priceHistory, setPriceHistory] = useState([])
  const [orders, setOrders] = useState([])

  const api = axios.create({
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
    withCredentials: true
  })

  const fetchQuotes = async () => {
    const res = await api.get('/api/quotes')
    setQuotes(res.data.quotes)
    const chosen = res.data.quotes.find(q => q.symbol === selected) || res.data.quotes[0]
    if (chosen) {
      setSelected(chosen.symbol)
      setPriceHistory(prev => [...prev.slice(-80), { symbol: chosen.symbol, price: chosen.price }])
    }
  }

  const fetchOrders = async () => {
    const res = await api.get('/api/orders')
    setOrders(res.data.orders.reverse())
  }

  const placeOrder = async (payload) => {
    await api.post('/api/orders', payload)
    fetchOrders()
  }

  const logout = async () => {
    try { await axios.post('/api/auth/logout', {}, { withCredentials: true }) } catch {}
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  useEffect(() => {
    fetchQuotes()
    fetchOrders()
    const iv = setInterval(fetchQuotes, 2000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onLogout={logout} />
      <div className="p-3 grid grid-cols-12 gap-3">
        <div className="col-span-3 h-[70vh]"><Watchlist symbols={quotes} selected={selected} onSelect={setSelected} /></div>
        <div className="col-span-6 h-[70vh]"><ChartPanel symbol={selected} priceHistory={priceHistory} /></div>
        <div className="col-span-3 h-[70vh]"><Orders onPlace={placeOrder} orders={orders} /></div>
      </div>
    </div>
  )
}
