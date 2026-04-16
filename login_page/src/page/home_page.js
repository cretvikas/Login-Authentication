import React from 'react';
import { useNavigate } from 'react-router-dom';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .home-root {
    background: #0b0b0e;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'DM Sans', sans-serif;
    color: #f0ece4;
    position: relative;
    overflow: hidden;
    padding: 40px;
  }

  .home-orb-a {
    position: fixed;
    top: -20%;
    left: -15%;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(200,169,110,0.06) 0%, transparent 65%);
    pointer-events: none;
    animation: homeDriftA 16s ease-in-out infinite alternate;
  }
  
  .home-orb-b {
    position: fixed;
    bottom: -15%;
    right: -10%;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(100,130,200,0.05) 0%, transparent 65%);
    pointer-events: none;
    animation: homeDriftB 14s ease-in-out infinite alternate;
  }

  @keyframes homeDriftA { from { transform: translate(0,0); } to { transform: translate(60px,40px); } }
  @keyframes homeDriftB { from { transform: translate(0,0); } to { transform: translate(-40px,-60px); } }
  @keyframes slideUpFade {
    0% { opacity: 0; transform: translateY(30px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  .home-header {
    text-align: center;
    margin-bottom: 60px;
    z-index: 10;
    animation: slideUpFade 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }

  .home-headline {
    font-family: 'Cormorant Garamond', serif;
    font-size: 46px;
    font-weight: 600;
    letter-spacing: -0.5px;
    margin-bottom: 12px;
    background: linear-gradient(to right, #ffffff, #c8a96e);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .home-subtitle {
    font-size: 16px;
    color: #8b867c;
    font-weight: 300;
    max-width: 480px;
    margin: 0 auto;
    line-height: 1.6;
  }

  .apps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 30px;
    width: 100%;
    max-width: 1000px;
    z-index: 10;
  }

  .app-card {
    background: rgba(17, 17, 20, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    padding: 36px 32px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    cursor: pointer;
    text-decoration: none;
    position: relative;
    overflow: hidden;
    animation: slideUpFade 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    opacity: 0;
  }
  
  .app-card:nth-child(1) { animation-delay: 0.1s; }
  .app-card:nth-child(2) { animation-delay: 0.2s; }
  .app-card:nth-child(3) { animation-delay: 0.3s; }

  .app-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 100%;
    background: radial-gradient(circle at center 0, rgba(200,169,110,0.1) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.4s;
    pointer-events: none;
  }

  .app-card:hover {
    transform: translateY(-8px);
    border-color: rgba(200,169,110,0.3);
    box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(200,169,110,0.06);
  }

  .app-card:hover::before {
    opacity: 1;
  }

  .app-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: rgba(200,169,110,0.1);
    color: #c8a96e;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    transition: transform 0.4s;
  }

  .app-icon svg {
    width: 28px;
    height: 28px;
  }

  .app-card:hover .app-icon {
    transform: scale(1.1);
    background: rgba(200,169,110,0.15);
  }

  .app-title {
    font-size: 20px;
    font-weight: 500;
    color: #f0ece4;
    margin-bottom: 10px;
  }

  .app-desc {
    font-size: 14px;
    color: #6b6760;
    line-height: 1.6;
    margin-bottom: 28px;
    flex-grow: 1;
  }

  .app-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #c8a96e;
    transition: gap 0.3s;
  }

  .app-card:hover .app-link {
    gap: 12px;
  }
`;

export default function HomePage() {
  const navigate = useNavigate();

  const handleNavigate = (clientId) => {
    navigate(`/?clientId=${clientId}`);
  };

  const applications = [
    {
      id: "client-app-1",
      name: "Analytics Dashboard",
      description: "Access your real-time analytics, metrics, and data visualization tools.",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      )
    },
    {
      id: "client-app-2",
      name: "HR Portal",
      description: "Manage employee records, time-off requests, and organization charts.",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      )
    },
    {
      id: "client-app-3",
      name: "Finance Tool",
      description: "Access corporate financial reports, budgeting tools, and expense tracking.",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      )
    }
  ];

  return (
    <>
      <style>{styles}</style>
      <div className="home-root">
        <div className="home-orb-a" />
        <div className="home-orb-b" />

        <div className="home-header">
          <h1 className="home-headline">Organization Hub</h1>
          <p className="home-subtitle">Select an application below to securely sign in.</p>
        </div>

        <div className="apps-grid">
          {applications.map((app) => (
            <div key={app.id} className="app-card" onClick={() => handleNavigate(app.id)}>
              <div className="app-icon">{app.icon}</div>
              <h2 className="app-title">{app.name}</h2>
              <p className="app-desc">{app.description}</p>
              <div className="app-link">
                <span>Sign in</span>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
