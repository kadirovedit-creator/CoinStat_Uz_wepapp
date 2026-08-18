"""Redis caching service for admin panel"""
import json
import logging
from typing import Any

from admin.config import REDIS_URL

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as aioredis

    _redis: aioredis.Redis | None = None


    async def get_redis() -> aioredis.Redis | None:
        """Get or create Redis connection"""
        global _redis
        if _redis is None:
            try:
                _redis = aioredis.from_url(
                    REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=3,
                    socket_timeout=5,
                )
                await _redis.ping()
                logger.info("Redis connected successfully")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}. Caching disabled.")
                _redis = None
        return _redis


    async def cache_get(key: str) -> Any | None:
        """Get cached value by key"""
        r = await get_redis()
        if not r:
            return None
        try:
            data = await r.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.warning(f"Redis get error: {e}")
            return None


    async def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
        """Set cached value with TTL (default 5 minutes)"""
        r = await get_redis()
        if not r:
            return False
        try:
            await r.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.warning(f"Redis set error: {e}")
            return False


    async def cache_delete(key: str) -> bool:
        """Delete cached value"""
        r = await get_redis()
        if not r:
            return False
        try:
            await r.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis delete error: {e}")
            return False


    async def cache_invalidate_pattern(pattern: str) -> bool:
        """Invalidate all cache keys matching pattern"""
        r = await get_redis()
        if not r:
            return False
        try:
            cursor = 0
            while True:
                cursor, keys = await r.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await r.delete(*keys)
                if cursor == 0:
                    break
            return True
        except Exception as e:
            logger.warning(f"Redis invalidation error: {e}")
            return False

except ImportError:
    logger.warning("redis package not installed. Caching disabled.")

    async def get_redis() -> None:
        return None

    async def cache_get(key: str) -> None:
        return None

    async def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
        return False

    async def cache_delete(key: str) -> bool:
        return False

    async def cache_invalidate_pattern(pattern: str) -> bool:
        return False
