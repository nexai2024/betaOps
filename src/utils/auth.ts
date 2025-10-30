// NextAuth Configuration for BetaOps

import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { compare } from "bcrypt";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/signin",
    signOut: "/signout",
    error: "/error",
    newUser: "/dashboard",
  },
  providers: [
    // GitHub OAuth Provider
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
    
    // Email/Password Provider
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "email@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }
        
        // Find user by email
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
        });
        
        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }
        
        // Verify password
        const isPasswordValid = await compare(
          credentials.password,
          user.password
        );
        
        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as any;
      }
      
      return session;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      
      // On first sign in
      if (account && user) {
        // Update user's email verified status for OAuth
        if (account.provider === "github") {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              emailVerified: new Date(),
            },
          });
        }
      }
      
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      console.log("New user created:", user.email);
      
      // Could send welcome email here
    },
    async signIn({ user, account, profile }) {
      console.log("User signed in:", user.email);
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
