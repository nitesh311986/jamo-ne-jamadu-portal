import { RoleName } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      fullName: string;
      role: RoleName;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
