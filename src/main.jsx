import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import WineCellar from './WineCellar'
import Auth from './Auth'
import { supabase } from './supabase'
import './index.css'

function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-500">Loading...</div>
      </div>
    );
  }

  // Keyed by user so switching accounts remounts with a clean slate.
  return session ? <WineCellar key={session.user.id} session={session} /> : <Auth />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
