import axios from "axios";
import { API_BASE_URL } from "./constants";


export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  roleType: "USER" | "ADMIN";
  gender: "MALE" | "FEMALE";
  createdAt: string;
  updatedAt: string;
}


export async function getCurrentUser(token: string): Promise<User> {
  const response = await axios.get(`${API_BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}


export async function updateCurrentUser(
  token: string,
  data: Partial<Pick<User, "firstName" | "lastName" | "email" | "age" | "gender">>
): Promise<User> {
  const response = await axios.put(`${API_BASE_URL}/users/me`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}
