export type RoleName = 'SUPER_ADMIN' | 'VOLUNTEER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: RoleName;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  role: RoleName;
}

export interface UserListResponse {
  users: User[];
}

export interface MeResponse {
  user: User;
}

export interface ApiError {
  error: string;
}
