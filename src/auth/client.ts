import { createPortalAuth } from "@/auth/create-portal-auth";

const portalAuth = createPortalAuth("client");

export const handlers = portalAuth.handlers;
export const auth = portalAuth.auth;
export const signIn = portalAuth.signIn;
export const signOut = portalAuth.signOut;
