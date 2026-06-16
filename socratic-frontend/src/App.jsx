import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import {
  Plus,
  MessageSquare,
  LayoutDashboard,
  Sun,
  Moon,
  PanelLeft,
  X,
  ChevronUp,
  Brain,
  LogOut, // ← add this
} from "lucide-react";
import { LIGHT_THEME, DARK_THEME } from "./components/shared/themeConfig";
import Chatbot from "./components/Chatbot";
import Dashboard from "./components/Dashboard";
import SignUp from "./Signup";
import Login from "./Login";
import "./App.css";

// Auth guard – redirects to /signup if no token
function PrivateRoute({ children }) {
  const token = localStorage.getItem("fehm_token");
  return token ? children : <Navigate to="/signup" replace />;
}

// AppShell – only shown when logged in
function AppShell() {
  const navigate = useNavigate();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fehm_theme")) ?? false;
    } catch {
      return false;
    }
  });

  const [messages, setMessages] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("fehm_chat"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState("chat");
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeRef = useRef(null);
  const colors = isDarkMode ? DARK_THEME : LIGHT_THEME;

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--bg", colors.bg);
    r.style.setProperty("--sidebar-bg", colors.sidebar);
    r.style.setProperty("--text", colors.text);
    r.style.setProperty("--panel", colors.panel);
    r.style.setProperty("--accent", colors.accent);
    r.style.setProperty("--border", colors.border);
    r.style.setProperty("--user-bubble", colors.userBubble);
    r.style.setProperty("--silver-btn", colors.silverBtn);
    r.style.setProperty("--success", colors.success);
    r.style.setProperty("--warning", colors.warning);
    r.style.setProperty("--danger", colors.danger);
    document.body.style.background = colors.bg;
    document.body.style.color = colors.text;
    localStorage.setItem("fehm_theme", JSON.stringify(isDarkMode));
  }, [isDarkMode, colors]);

  useEffect(() => {
    localStorage.setItem("fehm_chat", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    const handler = (e) => {
      if (themeRef.current && !themeRef.current.contains(e.target))
        setShowThemeMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("fehm_token");
    localStorage.removeItem("fehm_user");
    navigate("/login");
  };

  const startNewChat = () => {
    if (!window.confirm("Start a new session?")) return;
    if (messages.length > 2) {
      axios
        .post("http://127.0.0.1:8000/memorize", {
          student_name: "Taha",
          chat_history: messages.map((m) => `${m.sender}: ${m.text}`),
        })
        .catch(() => {});
    }
    setMessages([]);
    localStorage.removeItem("fehm_chat");
    setActiveView("chat");
  };

  return (
    <div
      className={`app-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
    >
      <aside className="sidebar">
        <div className="sidebar-content">
          <button
            className="close-sidebar-btn"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
          <div className="logo" onClick={() => setActiveView("chat")}>
            <Brain size={22} strokeWidth={2} />
            <span className="logo-text">FEHM.AI</span>
          </div>
          <button className="new-chat-btn" onClick={startNewChat}>
            <Plus size={18} strokeWidth={2.5} />
            <span className="btn-label">New Chat</span>
          </button>
          <nav className="sidebar-nav">
            <div
              className={`nav-link ${activeView === "chat" ? "active" : ""}`}
              onClick={() => {
                setActiveView("chat");
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
            >
              <MessageSquare size={20} strokeWidth={2} />
              <span className="nav-label">Chat</span>
            </div>
            <div
              className={`nav-link ${activeView === "dashboard" ? "active" : ""}`}
              onClick={() => {
                setActiveView("dashboard");
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
            >
              <LayoutDashboard size={20} strokeWidth={2} />
              <span className="nav-label">Dashboard</span>
            </div>
          </nav>
          <button className="sign-out-btn" onClick={handleLogout}>
            <LogOut size={18} strokeWidth={2} />
            <span>Sign out</span>
          </button>
          <div className="theme-container" ref={themeRef}>
            {showThemeMenu && (
              <div className="theme-popup">
                <div
                  className={`theme-option ${!isDarkMode ? "active" : ""}`}
                  onClick={() => {
                    setIsDarkMode(false);
                    setShowThemeMenu(false);
                  }}
                >
                  <Sun size={14} /> <span>Light</span>
                </div>
                <div
                  className={`theme-option ${isDarkMode ? "active" : ""}`}
                  onClick={() => {
                    setIsDarkMode(true);
                    setShowThemeMenu(false);
                  }}
                >
                  <Moon size={14} /> <span>Dark</span>
                </div>
              </div>
            )}
            <div
              className="theme-trigger"
              onClick={() => setShowThemeMenu(!showThemeMenu)}
            >
              {isDarkMode ? (
                <Moon size={16} strokeWidth={2} />
              ) : (
                <Sun size={16} strokeWidth={2} />
              )}
              <span className="btn-label">Theme</span>
              <ChevronUp
                size={12}
                strokeWidth={2}
                style={{
                  transform: showThemeMenu ? "rotate(0deg)" : "rotate(180deg)",
                  transition: "transform 0.2s",
                }}
              />
            </div>
          </div>
        </div>
      </aside>
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="main-view">
        <header className="topbar">
          <button
            className="topbar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <PanelLeft size={20} strokeWidth={2} />
          </button>
          <div className="topbar-title">
            <Brain size={16} strokeWidth={2} />
            FEHM.AI // {activeView.toUpperCase()}
          </div>
        </header>
        <div className="view-content">
          {activeView === "chat" ? (
            <Chatbot
              colors={colors}
              isDarkMode={isDarkMode}
              messages={messages}
              setMessages={setMessages}
            />
          ) : (
            <Dashboard colors={colors} isDarkMode={isDarkMode} />
          )}
        </div>
      </div>
    </div>
  );
}

// Root component – expects BrowserRouter already in index.js
export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
