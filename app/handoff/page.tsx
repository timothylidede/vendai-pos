'use client'

import { useEffect, useState } from 'react'

export default function HandoffPage() {
  const [tried, setTried] = useState(false)

  useEffect(() => {
    const openApp = () => {
      try {
        const a = document.createElement('a')
        a.href = 'vendai-pos://oauth/success'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTried(true)
      } catch (_) {
        setTried(true)
      }
    }
    const t = setTimeout(openApp, 100)
    const t2 = setTimeout(openApp, 900)
    return () => { clearTimeout(t); clearTimeout(t2) }
  }, [])

  return (
    <div className="module-background" style={{minHeight:'100vh',display:'grid',placeItems:'center',color:'#e5e7eb',fontFamily:'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial'}}>
      <div style={{width:'min(560px,92vw)',padding:28,borderRadius:16,background:'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',border:'1px solid rgba(255,255,255,0.1)',textAlign:'center'}}>
        <div style={{display:'inline-flex',width:56,height:56,borderRadius:999,alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#22c55e33,#10b98122)',border:'1px solid #10b98155',boxShadow:'inset 0 0 20px #10b98111, 0 8px 24px rgba(16,185,129,0.15)'}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <div style={{fontSize:22,fontWeight:700,margin:'8px 0 4px'}}>Continue in Vendai</div>
  <div style={{color:'#9ca3af',fontSize:14,margin:'6px 0 18px'}}>We&apos;re opening the app. If nothing happens, click the button below.</div>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          <a href="vendai-pos://oauth/success" rel="noopener" style={{display:'inline-flex',gap:8,alignItems:'center',justifyContent:'center',padding:'12px 16px',borderRadius:10,border:'1px solid rgba(255,255,255,0.15)',background:'#ffffff',color:'#111827',fontWeight:600,textDecoration:'none'}}>Open Vendai</a>
        </div>
        <div style={{marginTop:18,fontSize:12,color:'#94a3b8'}}>{tried ? 'If you see a prompt, choose Open.' : 'Attempting to open the app...'}</div>
      </div>
    </div>
  )
}
