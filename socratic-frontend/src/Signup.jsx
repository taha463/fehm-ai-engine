import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Brain, Eye, EyeOff, Loader } from "lucide-react";
import "./Auth.css";

const ArtPanel = () => (
  <>
    <svg
      viewBox="0 0 600 900"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="sg1" cx="30%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sg2" cx="75%" cy="65%" r="50%">
          <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sg3" cx="50%" cy="85%" r="42%">
          <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0" />
        </radialGradient>
        <filter id="sf">
          <feGaussianBlur stdDeviation="24" />
        </filter>
      </defs>
      <rect width="600" height="900" fill="#f0f4ff" />
      <rect width="600" height="900" fill="url(#sg1)" filter="url(#sf)" />
      <rect width="600" height="900" fill="url(#sg2)" filter="url(#sf)" />
      <rect width="600" height="900" fill="url(#sg3)" filter="url(#sf)" />

      {/* Grid – more visible */}
      {[100, 200, 300, 400, 500].map((x) => (
        <line
          key={x}
          x1={x}
          y1="0"
          x2={x}
          y2="900"
          stroke="#a5b4fc"
          strokeOpacity="0.25"
          strokeWidth="1.2"
        />
      ))}
      {[150, 300, 450, 600, 750].map((y) => (
        <line
          key={y}
          x1="0"
          y1={y}
          x2="600"
          y2={y}
          stroke="#a5b4fc"
          strokeOpacity="0.25"
          strokeWidth="1.2"
        />
      ))}

      {/* Dots */}
      {[
        [140, 190],
        [300, 155],
        [460, 215],
        [100, 370],
        [265, 335],
        [430, 365],
        [545, 295],
        [175, 510],
        [340, 485],
        [490, 520],
        [115, 670],
        [295, 645],
        [455, 670],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="4.5"
          fill="#818cf8"
          fillOpacity="0.6"
        />
      ))}

      {/* Dashed connections */}
      {[
        [140, 190, 300, 155],
        [300, 155, 460, 215],
        [140, 190, 100, 370],
        [300, 155, 265, 335],
        [460, 215, 430, 365],
        [460, 215, 545, 295],
        [100, 370, 175, 510],
        [265, 335, 340, 485],
        [430, 365, 490, 520],
        [175, 510, 115, 670],
        [340, 485, 295, 645],
        [490, 520, 455, 670],
        [100, 370, 265, 335],
        [265, 335, 430, 365],
        [175, 510, 340, 485],
        [340, 485, 490, 520],
      ].map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#a5b4fc"
          strokeWidth="1.2"
          strokeOpacity="0.45"
          strokeDasharray="5 7"
        />
      ))}

      {/* Center circle – more prominent */}
      <circle
        cx="300"
        cy="335"
        r="48"
        fill="#ffffffcc"
        stroke="#4f46e5"
        strokeWidth="2"
        strokeOpacity="0.8"
      />
      {/* Socratic face – darker and thicker */}
      <g
        transform="translate(274,309)"
        fill="none"
        stroke="#4f46e5"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M10,8 C10,3 17,1 22,4 C27,1 34,3 34,8 C37,9 40,14 37,18 C40,22 37,28 34,28 C34,31 30,34 25,32 C22,34 18,34 15,32 C10,34 6,31 6,28 C3,28 0,22 3,18 C0,14 3,9 6,8 Z" />
        <path d="M22,8 L22,31" />
        <path d="M6,18 C10,16 15,18 22,18 C29,18 34,16 38,18" />
        <path d="M10,11 C13,13 17,13 22,11" />
        <path d="M34,11 C31,13 27,13 22,11" />
      </g>

      {/* Decorative ? and ∴ – more visible */}
      <text
        x="55"
        y="130"
        fontSize="58"
        fill="#818cf8"
        fillOpacity="0.5"
        fontWeight="700"
      >
        ?
      </text>
      <text
        x="475"
        y="270"
        fontSize="44"
        fill="#60a5fa"
        fillOpacity="0.5"
        fontWeight="700"
      >
        ?
      </text>
      <text
        x="70"
        y="590"
        fontSize="38"
        fill="#c084fc"
        fillOpacity="0.55"
        fontWeight="700"
      >
        ∴
      </text>
      <text
        x="490"
        y="690"
        fontSize="38"
        fill="#a78bfa"
        fillOpacity="0.5"
        fontWeight="700"
      >
        ∴
      </text>
    </svg>
    <div className="auth-q auth-q-1">
      <p>What do you already know about this concept?</p>
    </div>
    <div className="auth-q auth-q-2">
      <p>How would you explain this to a friend?</p>
    </div>
    <div className="auth-q auth-q-3">
      <p>What changes when you look at it differently?</p>
    </div>
    <div className="auth-art-brand">
      <span>FEHM · AI &nbsp;·&nbsp; Socratic Intelligence</span>
    </div>
  </>
);

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm)
      return setError("Passwords don't match.");
    if (form.password.length < 8)
      return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      await axios.post("http://127.0.0.1:8000/auth/signup", {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      setError(
        err.response?.data?.detail || "Something went wrong. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-art">
        <ArtPanel />
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-logo">
            <Brain size={19} strokeWidth={2.2} color="#000" />
            <span className="auth-logo-name">FEHM.AI</span>
          </div>
          <h1 className="auth-title">Begin your inquiry.</h1>
          <p className="auth-sub">
            Every great mind started with a single question. Create your account
            and let curiosity lead the way.
          </p>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={onSubmit} className="auth-fields">
            <div className="auth-field">
              <label>Full name</label>
              <input
                name="name"
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={onChange}
                required
                autoComplete="name"
              />
            </div>
            <div className="auth-field">
              <label>Email address</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={onChange}
                required
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <div className="auth-pass-wrap">
                <input
                  name="password"
                  type={showPass ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={onChange}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPass((p) => !p)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="auth-field">
              <label>Confirm password</label>
              <div className="auth-pass-wrap">
                <input
                  name="confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat password"
                  value={form.confirm}
                  onChange={onChange}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowConfirm((p) => !p)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <Loader size={16} className="auth-spin" />
              ) : (
                "Create account"
              )}
            </button>
          </form>
          <p className="auth-notice">
            Your data stays private. Never sold, never shared.
          </p>
          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/login" className="auth-link">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
