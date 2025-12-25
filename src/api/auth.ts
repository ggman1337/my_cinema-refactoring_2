
import axios from "axios";
import { API_BASE_URL } from "./constants";

const API_URL = `${API_BASE_URL}/auth`;

export interface AuthResponse {
  accessToken: string;
}

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: "MALE" | "FEMALE";
}): Promise<AuthResponse> {
  const response = await axios.post(`${API_URL}/register`, data, {
    headers: { "Content-Type": "application/json" },
  });
  localStorage.setItem("token", response.data.accessToken);
  return response.data;
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await axios.post(`${API_URL}/login`, data, {
    headers: { "Content-Type": "application/json" },
  });
  localStorage.setItem("token", response.data.accessToken);
  return response.data;
}

export function logout() {
  localStorage.removeItem("token");
}

export function getCurrentUser() {
  const token = localStorage.getItem("token");
  return token ? { accessToken: token } : null;
}
