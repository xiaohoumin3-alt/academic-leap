import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface User {
    grade?: number;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      grade?: number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    grade?: number;
  }
}
