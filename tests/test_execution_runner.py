import asyncio

from app.models.messages import JobState, MetricsMessage, RunJobRequest, StatusMessage, StdoutMessage
from app.services.execution import ExecutionRunner


def test_execution_runner_uses_subprocess_fallback_and_collects_outputs(monkeypatch):
    monkeypatch.setenv("COMPUTEBNB_DISABLE_DOCKER", "1")
    runner = ExecutionRunner()
    messages = []

    async def exercise():
        async def send(message):
            messages.append(message)

        request = RunJobRequest(
            job_id="job-test-1",
            job_name="Fallback Test",
            filename="main.py",
            timeout_secs=5,
            code=(
                "import time\n"
                "from pathlib import Path\n"
                "print('hello from guest')\n"
                "Path('result.txt').write_text('ok', encoding='utf-8')\n"
                "time.sleep(1.2)\n"
            ),
        )

        return await runner.run_job(request, send, asyncio.Event())

    result = asyncio.run(exercise())

    assert result.state == JobState.DONE
    assert result.backend == "subprocess"
    assert any(isinstance(message, StatusMessage) and message.state == JobState.RUNNING for message in messages)
    assert any(isinstance(message, StdoutMessage) and "hello from guest" in message.data for message in messages)
    assert any(isinstance(message, MetricsMessage) for message in messages)
    assert any(artifact.name == "result.txt" for artifact in result.artifacts)
