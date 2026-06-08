/**
 * Minimal Pusher WebSocket client for React Native.
 * Uses the built-in WebSocket API — no native modules needed.
 */

type EventCallback = (data: any) => void;

interface PusherChannel {
    name: string;
    bind: (event: string, callback: EventCallback) => void;
    unbind_all: () => void;
}

export class PusherClient {
    private ws: WebSocket | null = null;
    private key: string;
    private cluster: string;
    private channels: Map<string, Map<string, EventCallback[]>> = new Map();
    private pingInterval: ReturnType<typeof setInterval> | null = null;
    private subscribedChannels: Set<string> = new Set();
    private reconnectAttempts: number = 0;
    private isConnecting: boolean = false;
    private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds

    constructor(key: string, options: { cluster: string }) {
        // Sanitize: remove quotes and whitespace that might come from .env parsing
        this.key = (key || "").replace(/['"]/g, "").trim();
        this.cluster = (options.cluster || "").replace(/['"]/g, "").trim();
        
        if (!this.key || !this.cluster) {
            console.error("[PusherClient] Error: Missing key or cluster during initialization.");
            return;
        }

        console.log(`[PusherClient] Initializing with key: ${this.key.slice(0, 5)}... (Cluster: ${this.cluster})`);
        this.connect();
    }

    private connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;
        const url = `wss://ws-${this.cluster}.pusher.com/app/${this.key}?protocol=7&client=react-native&version=8.0.0`;
        console.log(`[PusherClient] Connecting to ${url.replace(this.key, "MASKED")}`);
        
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            try { this.ws.close(); } catch (e) {}
        }

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log(`[PusherClient] Connection established!`);
            this.isConnecting = false;
            this.reconnectAttempts = 0; // Reset on successful connection

            // Re-subscribe to all channels on reconnect
            this.subscribedChannels.forEach((channel) => {
                this.sendSubscribe(channel);
            });

            // Keep-alive ping every 30s
            if (this.pingInterval) clearInterval(this.pingInterval);
            this.pingInterval = setInterval(() => {
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ event: "pusher:ping", data: {} }));
                }
            }, 30000);
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                const { channel, event: eventName, data } = message;

                if (eventName === "pusher:error") {
                    console.warn("[PusherClient] Pusher Protocol Error:", data);
                    return;
                }

                if (eventName === "pusher:ping") {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({ event: "pusher:pong", data: {} }));
                    }
                    return;
                }

                if (eventName === "pusher:pong") return;

                console.log(`[PusherClient] Event received: ${eventName} on channel: ${channel || 'none'}`);

                if (!channel || !eventName) return;

                const channelListeners = this.channels.get(channel);
                if (!channelListeners) return;

                const callbacks = channelListeners.get(eventName);
                if (!callbacks) return;

                const parsedData = typeof data === "string" ? JSON.parse(data) : data;
                callbacks.forEach((cb) => cb(parsedData));
            } catch (err) {
                // ignore parse errors
            }
        };

        this.ws.onclose = (e) => {
            this.isConnecting = false;
            console.log(`[PusherClient] Connection closed: ${e.code} ${e.reason || 'No reason'}`);
            if (this.pingInterval) clearInterval(this.pingInterval);
            
            // Reconnect with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.MAX_RECONNECT_DELAY);
            this.reconnectAttempts++;
            
            console.log(`[PusherClient] Attempting to reconnect in ${delay / 1000}s...`);
            setTimeout(() => {
                this.connect();
            }, delay);
        };

        this.ws.onerror = (e: any) => {
            this.isConnecting = false;
            const errorInfo = e.message || JSON.stringify(e);
            console.warn(`[PusherClient] WebSocket Error:`, errorInfo);
            
            // If the error is immediate, it might be a bad URL or blocked connection
            if (this.ws?.readyState !== WebSocket.OPEN) {
                console.warn("[PusherClient] Connection failed or was rejected. Check credentials and network.");
            }
            // onclose will handle the reconnection
            try { this.ws?.close(); } catch (err) {}
        };
    }

    private sendSubscribe(channelName: string) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log(`[PusherClient] Subscribing to channel: ${channelName}`);
            this.ws.send(JSON.stringify({
                event: "pusher:subscribe",
                data: { channel: channelName }
            }));
        }
    }

    subscribe(channelName: string): PusherChannel {
        if (!this.channels.has(channelName)) {
            this.channels.set(channelName, new Map());
        }
        this.subscribedChannels.add(channelName);
        this.sendSubscribe(channelName);

        const self = this;
        return {
            name: channelName,
            bind(event: string, callback: EventCallback) {
                const channelMap = self.channels.get(channelName)!;
                if (!channelMap.has(event)) {
                    channelMap.set(event, []);
                }
                channelMap.get(event)!.push(callback);
            },
            unbind_all() {
                self.channels.get(channelName)?.clear();
            }
        };
    }

    unsubscribe(channelName: string) {
        console.log(`[PusherClient] Unsubscribing from channel: ${channelName}`);
        this.channels.delete(channelName);
        this.subscribedChannels.delete(channelName);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                event: "pusher:unsubscribe",
                data: { channel: channelName }
            }));
        }
    }

    disconnect() {
        console.log("[PusherClient] Disconnecting...");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this.channels.clear();
        this.subscribedChannels.clear();
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            try { this.ws.close(); } catch (e) {}
            this.ws = null;
        }
    }
}
