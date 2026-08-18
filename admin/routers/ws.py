"""WebSocket router for real-time admin panel updates"""
import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from admin.services.auth_service import decode_access_token

logger = logging.getLogger(__name__)
router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections"""

    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}  # admin_id -> [websockets]

    async def connect(self, websocket: WebSocket, admin_id: int):
        await websocket.accept()
        if admin_id not in self.active_connections:
            self.active_connections[admin_id] = []
        self.active_connections[admin_id].append(websocket)
        logger.info(f"Admin {admin_id} connected via WebSocket")

    def disconnect(self, websocket: WebSocket, admin_id: int):
        if admin_id in self.active_connections:
            if websocket in self.active_connections[admin_id]:
                self.active_connections[admin_id].remove(websocket)
            if not self.active_connections[admin_id]:
                del self.active_connections[admin_id]
        logger.info(f"Admin {admin_id} disconnected from WebSocket")

    async def send_to_admin(self, admin_id: int, message: dict):
        """Send a message to all connections of a specific admin"""
        if admin_id not in self.active_connections:
            return
        dead_connections = []
        for ws in self.active_connections[admin_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.append(ws)
        for ws in dead_connections:
            self.disconnect(ws, admin_id)

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected admins"""
        for admin_id in list(self.active_connections.keys()):
            await self.send_to_admin(admin_id, message)


manager = ConnectionManager()


@router.websocket("/api/admin/ws")
async def admin_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time admin updates"""
    # Expect token as first message
    try:
        await websocket.accept()
        data = await websocket.receive_text()
        msg = json.loads(data)
        token = msg.get("token", "")

        payload = decode_access_token(token)
        if not payload:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close()
            return

        admin_id = int(payload.get("sub", 0))
        await manager.connect(websocket, admin_id)

        # Send confirmation
        await websocket.send_json({
            "type": "connected",
            "admin_id": admin_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Keep connection alive and listen for pings
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if 'admin_id' in locals():
            manager.disconnect(websocket, admin_id)
