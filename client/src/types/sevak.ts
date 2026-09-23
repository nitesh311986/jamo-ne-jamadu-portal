export interface Sevak {
  id: string;
  sevakCode: string;
  fullName: string;
  firstName: string;
  lastName: string;
  mobile: string;
  altMobile: string | null;
  whatsapp: string | null;
  address: string;
  mandal: string;
  kshetra: string;
  expectedContacts: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSevakRequest {
  fullName: string;
  firstName: string;
  lastName: string;
  mobile: string;
  altMobile?: string;
  whatsapp?: string;
  address: string;
  mandal: string;
  kshetra: string;
  expectedContacts: number;
}

export interface UpdateSevakRequest {
  fullName: string;
  firstName: string;
  lastName: string;
  mobile: string;
  altMobile?: string;
  whatsapp?: string;
  address: string;
  mandal: string;
  kshetra: string;
  expectedContacts: number;
}

export interface SevakResponse {
  sevak: Sevak;
}

export interface MessageResponse {
  message: string;
}

export interface SevakSearchResponse {
  sevaks: Sevak[];
  total: number;
  page: number;
  limit: number;
}
