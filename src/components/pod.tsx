"use client";

import { useEffect, useState, useCallback } from "react";
import { useHostedApi, type MemberAuth } from "@/hooks/use-hosted-api";
import { setAuthCookies, checkAuth } from "@/actions/auth";
import { Chat } from "./chat";

interface PodProps {
  ticketId?: number;
  screen?: string;
}

export function Pod({ ticketId: propTicketId, screen: propScreen }: PodProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  
  // Check for existing auth cookies on mount (CW sets these automatically)
  useEffect(() => {
    checkAuth().then((result) => {
      if (result.authenticated) {
        setIsAuthenticated(true);
      }
    });
  }, []);
  
  const handleAuth = useCallback(async (auth: MemberAuth) => {
    try {
      await setAuthCookies(auth);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (err) {
      console.error("Auth error:", err);
      setAuthError("Failed to authenticate with ConnectWise");
    }
  }, []);

  const handleReady = useCallback(() => {
    // Pod ready - auth check happens via useEffect
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error("TicketWise: API error", error);
    setAuthError(error.message);
  }, []);

  const { isReady, requestAuth, requestScreenObject, auth, screenObject } = useHostedApi({
    onReady: handleReady,
    onAuth: handleAuth,
    onError: handleError,
  });
  
  // Derive ticket ID from screen object or props
  const ticketId = screenObject?.id ? Number(screenObject.id) : propTicketId;
  const screen = screenObject?.screen || propScreen || "ticket";

  // Check if running standalone (not in iframe)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsStandalone(window === window.parent);
    }
  }, []);

  // Request auth (if not already authenticated) and screen object when ready
  useEffect(() => {
    if (isReady) {
      // Only request auth via postMessage if we don't have cookies
      if (!auth && !isAuthenticated) {
        requestAuth();
      }
      if (!screenObject) {
        requestScreenObject();
      }
    }
  }, [isReady, auth, isAuthenticated, screenObject, requestAuth, requestScreenObject]);

  // Standalone mode - show login prompt
  if (isStandalone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full text-center overflow-hidden">
          <div className="bg-[#222E40] px-8 py-6">
            <div className="w-14 h-14 bg-[#F8AB08] rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-white" width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">TicketWise</h1>
            <p className="text-slate-400 text-sm">AI-powered ticket assistant for ConnectWise PSA</p>
          </div>
          <div className="p-8">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Pod Mode Only</p>
              <p>
                This application is designed to run as a pod within ConnectWise PSA.
                Please access it through a service ticket in ConnectWise.
              </p>
            </div>
            <div className="mt-5 text-xs text-gray-400">
              Ticket #{ticketId} • Screen: {screen}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state - wait for ready and screen object (auth can come later)
  if (!isReady || !ticketId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#222E40] border-t-[#F8AB08] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-[#222E40]">
            {!isReady ? "Connecting to ConnectWise..." : "Loading ticket..."}
          </p>
          <p className="text-xs text-gray-400 mt-2 font-mono">
            ready: {String(isReady)} | auth: {String(!!auth)} | screen: {JSON.stringify(screenObject)}
          </p>
        </div>
      </div>
    );
  }

  // No ticket ID available
  if (!ticketId) {
    return (
      <div className="flex items-center justify-center h-full bg-white p-4">
        <div className="text-center max-w-md">
          <div className="text-amber-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 font-medium">No Ticket Context</p>
          <p className="text-xs text-gray-500 mt-1">
            Could not retrieve ticket information from ConnectWise.
            Please ensure this pod is opened from a service ticket.
          </p>
          <div className="mt-3 text-xs text-gray-400 font-mono">
            Screen: {screenObject ? JSON.stringify(screenObject) : "null"}
          </div>
        </div>
      </div>
    );
  }

  // Auth error
  if (authError) {
    return (
      <div className="flex items-center justify-center h-full bg-white p-4">
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm text-red-600 font-medium">Authentication Error</p>
          <p className="text-xs text-gray-500 mt-1">{authError}</p>
          <button
            onClick={() => {
              setAuthError(null);
              requestAuth();
            }}
            className="mt-3 px-4 py-1 bg-[#222E40] text-white rounded text-sm hover:bg-[#1a2433]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Chat ticketId={ticketId} isAuthenticated={isAuthenticated} />
    </div>
  );
}
