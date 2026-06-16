import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
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
        <radialGradient id="lg1" cx="65%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lg2" cx="25%" cy="70%" r="50%">
          <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lg3" cx="55%" cy="85%" r="42%">
          <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0" />
        </radialGradient>
        <filter id="lf">
          <feGaussianBlur stdDeviation="24" />
        </filter>
      </defs>
      <rect width="600" height="900" fill="#f0f4ff" />
      <rect width="600" height="900" fill="url(#lg1)" filter="url(#lf)" />
      <rect width="600" height="900" fill="url(#lg2)" filter="url(#lf)" />
      <rect width="600" height="900" fill="url(#lg3)" filter="url(#lf)" />

      <line
        x1="100"
        y1="0"
        x2="100"
        y2="900"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
      <line
        x1="200"
        y1="0"
        x2="200"
        y2="900"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
      <line
        x1="300"
        y1="0"
        x2="300"
        y2="900"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
      <line
        x1="400"
        y1="0"
        x2="400"
        y2="900"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
      <line
        x1="500"
        y1="0"
        x2="500"
        y2="900"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
      <line
        x1="0"
        y1="150"
        x2="600"
        y2="150"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
      <line
        x1="0"
        y1="300"
        x2="600"
        y2="300"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
      <line
        x1="0"
        y1="450"
        x2="600"
        y2="450"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
      <line
        x1="0"
        y1="600"
        x2="600"
        y2="600"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />
      <line
        x1="0"
        y1="750"
        x2="600"
        y2="750"
        stroke="#a5b4fc"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />

      {[
        [150, 185],
        [310, 150],
        [465, 210],
        [105, 365],
        [270, 330],
        [435, 360],
        [550, 290],
        [180, 505],
        [345, 480],
        [495, 515],
        [120, 665],
        [300, 640],
        [460, 665],
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

      {[
        [150, 185, 310, 150],
        [310, 150, 465, 210],
        [150, 185, 105, 365],
        [310, 150, 270, 330],
        [465, 210, 435, 360],
        [465, 210, 550, 290],
        [105, 365, 180, 505],
        [270, 330, 345, 480],
        [435, 360, 495, 515],
        [180, 505, 120, 665],
        [345, 480, 300, 640],
        [495, 515, 460, 665],
        [105, 365, 270, 330],
        [270, 330, 435, 360],
        [180, 505, 345, 480],
        [345, 480, 495, 515],
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

      <circle
        cx="300"
        cy="330"
        r="48"
        fill="#ffffffcc"
        stroke="#4f46e5"
        strokeWidth="2"
        strokeOpacity="0.8"
      />
      <g
        transform="translate(274,304)"
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

      <text
        x="480"
        y="140"
        fontSize="58"
        fill="#60a5fa"
        fillOpacity="0.5"
        fontWeight="700"
      >
        ?
      </text>
      <text
        x="55"
        y="280"
        fontSize="44"
        fill="#818cf8"
        fillOpacity="0.5"
        fontWeight="700"
      >
        ?
      </text>
      <text
        x="70"
        y="580"
        fontSize="38"
        fill="#c084fc"
        fillOpacity="0.55"
        fontWeight="700"
      >
        ∴
      </text>
      <text
        x="495"
        y="700"
        fontSize="38"
        fill="#a78bfa"
        fillOpacity="0.5"
        fontWeight="700"
      >
        ∴
      </text>
    </svg>
    <div className="auth-q auth-q-1">
      <p>Welcome back. What will you discover today?</p>
    </div>
    <div className="auth-q auth-q-2">
      <p>The unexamined mind is a mind half-used.</p>
    </div>
    <div className="auth-q auth-q-3">
      <p>
        "I know that I know nothing" — and that is where real learning begins.
      </p>
    </div>
    <div className="auth-art-brand">
      <span>FEHM · AI &nbsp;·&nbsp; Socratic Intelligence</span>
    </div>
  </>
);

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (location.state?.registered)
      setNotice("Account created! Sign in to begin.");
  }, [location.state]);

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post("http://127.0.0.1:8000/auth/login", {
        email: form.email,
        password: form.password,
      });
      localStorage.setItem("fehm_token", data.token);
      localStorage.setItem("fehm_user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Incorrect email or password.");
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
          <h1 className="auth-title">Good to see you again.</h1>
          <p className="auth-sub">
            Your questions haven't stopped while you were away. Pick up where
            your mind left off.
          </p>
          {notice && <div className="auth-success">{notice}</div>}
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={onSubmit} className="auth-fields">
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
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <div className="auth-pass-wrap">
                <input
                  name="password"
                  type={showPass ? "text" : "password"}
                  placeholder="Your password"
                  value={form.password}
                  onChange={onChange}
                  required
                  autoComplete="current-password"
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
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? <Loader size={16} className="auth-spin" /> : "Sign in"}
            </button>
          </form>
          <p className="auth-notice">
            Your sessions and memory are stored securely.
          </p>
          <p className="auth-switch">
            New to FEHM.AI?{" "}
            <Link to="/signup" className="auth-link">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
