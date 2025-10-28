import { useState, useEffect, useRef, useCallback } from 'react';

import type { SessionSDKOptions } from '@claude-agent-kit/server';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const messageQueueRef = useRef<string[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const handlersRef = useRef<{
    onMessage?: UseWebSocketOptions["onMessage"];
    onConnect?: UseWebSocketOptions["onConnect"];
    onDisconnect?: UseWebSocketOptions["onDisconnect"];
    onError?: UseWebSocketOptions["onError"];
  }>({
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  });

  useEffect(() => {
    handlersRef.current = {
      onMessage,
      onConnect,
      onDisconnect,
      onError,
    };
  }, [onMessage, onConnect, onDisconnect, onError]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, []);

  const connect = useCallback(() => {
    shouldReconnectRef.current = true;
    clearReconnectTimeout();

    const existingReadyState = wsRef.current?.readyState;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[useWebSocket] connect requested', {
        hasExistingSocket: Boolean(wsRef.current),
        existingReadyState,
      });
    }

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[useWebSocket] existing socket still active, skipping new connection');
      }
      return;
    }

    try {
      if (wsRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useWebSocket] closing existing socket before creating new one', {
            previousReadyState: wsRef.current.readyState,
          });
        }
        try {
          wsRef.current.close(4000, 'Replaced connection');
        } catch (closeError) {
          console.warn('[useWebSocket] failed to close existing socket before reconnect', closeError);
        }
        wsRef.current = null;
      }

      const ws = new WebSocket(url);
      wsRef.current = ws;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[useWebSocket] created new WebSocket instance', { url });
      }

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        clearReconnectTimeout();
        handlersRef.current.onConnect?.();

        // Send any queued messages
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift();
          if (message) {
            ws.send(message);
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handlersRef.current.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error, {
          readyState: wsRef.current?.readyState,
        });
        handlersRef.current.onError?.(error);
      };

      ws.onclose = (event) => {
        console.log(
          'WebSocket disconnected',
          {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          },
        );
        setIsConnected(false);
        handlersRef.current.onDisconnect?.();
        wsRef.current = null;

        if (!shouldReconnectRef.current) {
          reconnectAttemptsRef.current = 0;
          clearReconnectTimeout();
          return;
        }

        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.warn('Max reconnect attempts reached, giving up.');
          return;
        }

        const nextAttempt = reconnectAttemptsRef.current + 1;
        console.log(`Reconnecting in ${reconnectDelay}ms... (attempt ${nextAttempt}/${maxReconnectAttempts})`);
        clearReconnectTimeout();
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = undefined;
          reconnectAttemptsRef.current = nextAttempt;
          connect();
        }, reconnectDelay);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [url, reconnectDelay, maxReconnectAttempts, clearReconnectTimeout]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    const messageStr = JSON.stringify(message);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(messageStr);
    } else {
      // Queue the message if not connected
      if (process.env.NODE_ENV !== 'production') {
        console.log('WebSocket not connected, queuing message', {
          queueLength: messageQueueRef.current.length,
          readyState: wsRef.current?.readyState,
        });
      } else {
        console.log('WebSocket not connected, queuing message');
      }
      messageQueueRef.current.push(messageStr);
      
      // Try to reconnect if not already attempting
      if (!isConnected) {
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          reconnectAttemptsRef.current = 0;
        }
        connect();
      }
    }
  }, [isConnected, maxReconnectAttempts, connect]);

  const setSDKOptions = useCallback(
    (options: Partial<SessionSDKOptions>, sessionId?: string | null) => {
      const payload: WebSocketMessage = {
        type: 'setSDKOptions',
        options,
      };

      if (sessionId !== undefined) {
        payload.sessionId = sessionId;
      }

      sendMessage(payload);
    },
    [sendMessage],
  );

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearReconnectTimeout();
    if (process.env.NODE_ENV !== 'production') {
      console.log('[useWebSocket] disconnect called', {
        hasSocket: Boolean(wsRef.current),
        readyState: wsRef.current?.readyState,
      });
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    setIsConnected(false);
  }, [clearReconnectTimeout]);

  // Initialize connection
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    sendMessage,
    setSDKOptions,
    disconnect,
    reconnect: connect,
  };
}
