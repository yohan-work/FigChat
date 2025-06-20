const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');

class FigmaChatServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.rooms = new Map(); // roomId -> Set of clients
        this.clients = new Map(); // client -> { user, roomId }
        
        this.setupExpress();
        this.setupWebSocket();
    }
    
    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('.'));
        
        // 건강 체크 엔드포인트
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                rooms: this.rooms.size,
                connections: this.clients.size,
                timestamp: new Date().toISOString()
            });
        });
        
        // 방 목록 API
        this.app.get('/api/rooms', (req, res) => {
            const roomList = Array.from(this.rooms.keys()).map(roomId => ({
                roomId,
                userCount: this.rooms.get(roomId).size,
                users: Array.from(this.rooms.get(roomId)).map(client => 
                    this.clients.get(client)?.user
                ).filter(Boolean)
            }));
            
            res.json(roomList);
        });
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('새 클라이언트 연결됨');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (error) {
                    console.error('메시지 파싱 오류:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: '잘못된 메시지 형식입니다.'
                    }));
                }
            });
            
            ws.on('close', () => {
                console.log('클라이언트 연결 종료됨');
                this.handleDisconnection(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket 오류:', error);
            });
        });
    }
    
    handleMessage(ws, data) {
        switch (data.type) {
            case 'join-room':
                this.handleJoinRoom(ws, data);
                break;
                
            case 'message':
                this.handleChatMessage(ws, data);
                break;
                
            case 'typing':
                this.handleTyping(ws, data);
                break;
                
            case 'stop-typing':
                this.handleStopTyping(ws, data);
                break;
                
            default:
                console.log('알 수 없는 메시지 타입:', data.type);
        }
    }
    
    handleJoinRoom(ws, data) {
        const { roomId, user } = data;
        
        // 이전 방에서 나가기
        this.leaveCurrentRoom(ws);
        
        // 새 방에 참가
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        
        this.rooms.get(roomId).add(ws);
        this.clients.set(ws, { user, roomId });
        
        console.log(`${user.name}이(가) 방 ${roomId}에 참가했습니다.`);
        
        // 방의 다른 사용자들에게 알림
        this.broadcastToRoom(roomId, {
            type: 'user-joined',
            user: user,
            roomId: roomId
        }, ws);
        
        // 현재 방의 사용자 목록 전송
        const roomUsers = Array.from(this.rooms.get(roomId))
            .map(client => this.clients.get(client)?.user)
            .filter(Boolean);
            
        ws.send(JSON.stringify({
            type: 'room-users',
            users: roomUsers,
            roomId: roomId
        }));
    }
    
    handleChatMessage(ws, data) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo) {
            console.error('클라이언트 정보를 찾을 수 없습니다.');
            return;
        }
        
        const messageData = {
            type: 'message',
            content: data.content,
            user: clientInfo.user,
            timestamp: new Date().toISOString(),
            roomId: clientInfo.roomId
        };
        
        console.log(`[${clientInfo.roomId}] ${clientInfo.user.name}: ${data.content}`);
        
        // 같은 방의 모든 사용자에게 메시지 전송
        this.broadcastToRoom(clientInfo.roomId, messageData);
    }
    
    handleTyping(ws, data) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo) return;
        
        this.broadcastToRoom(clientInfo.roomId, {
            type: 'typing',
            user: clientInfo.user,
            roomId: clientInfo.roomId
        }, ws);
    }
    
    handleStopTyping(ws, data) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo) return;
        
        this.broadcastToRoom(clientInfo.roomId, {
            type: 'stop-typing',
            user: clientInfo.user,
            roomId: clientInfo.roomId
        }, ws);
    }
    
    handleDisconnection(ws) {
        const clientInfo = this.clients.get(ws);
        if (clientInfo) {
            console.log(`${clientInfo.user.name}이(가) 연결을 종료했습니다.`);
            
            // 방에서 제거
            this.leaveCurrentRoom(ws);
            
            // 방의 다른 사용자들에게 알림
            this.broadcastToRoom(clientInfo.roomId, {
                type: 'user-left',
                user: clientInfo.user,
                roomId: clientInfo.roomId
            });
        }
        
        this.clients.delete(ws);
    }
    
    leaveCurrentRoom(ws) {
        const clientInfo = this.clients.get(ws);
        if (clientInfo && clientInfo.roomId) {
            const room = this.rooms.get(clientInfo.roomId);
            if (room) {
                room.delete(ws);
                
                // 방이 비어있으면 삭제
                if (room.size === 0) {
                    this.rooms.delete(clientInfo.roomId);
                    console.log(`빈 방 ${clientInfo.roomId}을(를) 삭제했습니다.`);
                }
            }
        }
    }
    
    broadcastToRoom(roomId, data, excludeClient = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        const message = JSON.stringify(data);
        
        room.forEach(client => {
            if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    
    start(port = process.env.PORT || 3001) {
        this.server.listen(port, '0.0.0.0', () => {
            const baseUrl = process.env.RAILWAY_STATIC_URL || `http://localhost:${port}`;
            console.log(`🚀 Figma Chat Server가 포트 ${port}에서 시작되었습니다.`);
            console.log(`📊 상태 확인: ${baseUrl}/health`);
            console.log(`📋 방 목록: ${baseUrl}/api/rooms`);
            console.log(`🌐 WebSocket URL: ${baseUrl.replace('http', 'ws')}`);
        });
    }
    
    // 주기적으로 연결 상태 확인
    startHealthCheck() {
        setInterval(() => {
            this.wss.clients.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                }
            });
        }, 30000); // 30초마다 ping
    }
}

// 서버 시작
const chatServer = new FigmaChatServer();
chatServer.start();
chatServer.startHealthCheck();

// 우아한 종료 처리
process.on('SIGTERM', () => {
    console.log('서버를 종료합니다...');
    chatServer.wss.close(() => {
        chatServer.server.close(() => {
            console.log('서버가 정상적으로 종료되었습니다.');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('\n서버를 종료합니다...');
    chatServer.wss.close(() => {
        chatServer.server.close(() => {
            console.log('서버가 정상적으로 종료되었습니다.');
            process.exit(0);
        });
    });
}); 