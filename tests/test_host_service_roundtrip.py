import asyncio

from app.models.messages import RunJobRequest
from app.services.discovery import discovery_service
from app.services.host_service import host_service
from app.services.worker_client import HostClient


def test_host_service_accepts_job_and_streams_results(monkeypatch):
    monkeypatch.setenv("COMPUTEBNB_DISABLE_DOCKER", "1")
    monkeypatch.setattr(discovery_service, "register_host", lambda host: None)
    monkeypatch.setattr(discovery_service, "update_host", lambda host: None)
    monkeypatch.setattr(discovery_service, "unregister_host", lambda: None)

    async def exercise():
        client = None
        try:
            state = await host_service.start("Roundtrip Host")
            host = state.host
            assert host is not None

            client = HostClient(host.host, host.port)
            await client.connect()

            request = RunJobRequest(
                job_id="job-roundtrip-1",
                job_name="Roundtrip",
                guest_name="Guest Laptop",
                filename="main.py",
                timeout_secs=5,
                code="print('hello from host')\n",
            )

            await client.send_job(request)
            await asyncio.sleep(0.2)
            await host_service.decide_job(request.job_id, True)

            messages = []
            async for message in client.stream_responses():
                messages.append(message)
            return messages
        finally:
            if client:
                await client.disconnect()
            if host_service.get_state().running:
                await host_service.stop()

    messages = asyncio.run(exercise())

    assert any(message.get("type") == "status" and message.get("state") == "awaiting_accept" for message in messages)
    assert any(message.get("type") == "status" and message.get("state") == "running" for message in messages)
    assert any(message.get("type") == "stdout" and "hello from host" in message.get("data", "") for message in messages)
    assert any(message.get("type") == "done" and message.get("state") == "done" for message in messages)
