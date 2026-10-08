import httpx
from core.observability import logger

async def send_webhook_notification(webhook_url: str, payload: dict):
    """Send an outbound webhook notification for high-severity incidents."""
    if not webhook_url:
        return
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload, timeout=10.0)
            if response.status_code >= 400:
                logger.error(f"Webhook notification failed with status {response.status_code}")
            else:
                logger.info(f"Webhook notification sent successfully to {webhook_url}")
    except httpx.RequestError as e:
        logger.error(f"Failed to send webhook notification: {e}")
