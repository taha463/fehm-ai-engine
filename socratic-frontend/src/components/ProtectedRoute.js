// src/components/ProtectedRoute.js
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("fehm_token");
  return token ? children : <Navigate to="/login" replace />;
}