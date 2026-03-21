import asyncio
from typing import Dict, Callable, Optional
from zeroconf import ServiceBrowser, ServiceListener, Zeroconf, ServiceInfo
from app.models.messages import WorkerInfo, WorkerStatus

SERVICE_TYPE = "_compute-worker._tcp.local."


class WorkerDiscoveryListener(ServiceListener):
    def __init__(self, on_update: Optional[Callable] = None):
        self.workers: Dict[str, WorkerInfo] = {}
        self.on_update = on_update

    def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        info = zc.get_service_info(type_, name)
        if info:
            self._add_worker(info)

    def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        info = zc.get_service_info(type_, name)
        if info:
            self._add_worker(info)

    def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        worker_id = name.replace(f".{SERVICE_TYPE}", "")
        if worker_id in self.workers:
            del self.workers[worker_id]
            if self.on_update:
                self.on_update()

    def _add_worker(self, info: ServiceInfo) -> None:
        props = {k.decode(): v.decode() if isinstance(v, bytes) else v
                 for k, v in info.properties.items()}

        worker = WorkerInfo(
            worker_id=props.get("worker_id", info.name),
            display_name=props.get("display_name", info.name),
            host=info.parsed_addresses()[0] if info.parsed_addresses() else "",
            port=info.port,
            status=WorkerStatus(props.get("status", "idle")),
            platform=props.get("platform"),
        )
        self.workers[worker.worker_id] = worker
        if self.on_update:
            self.on_update()


class DiscoveryService:
    def __init__(self):
        self.zeroconf: Optional[Zeroconf] = None
        self.browser: Optional[ServiceBrowser] = None
        self.listener: Optional[WorkerDiscoveryListener] = None

    def start(self, on_update: Optional[Callable] = None) -> None:
        self.zeroconf = Zeroconf()
        self.listener = WorkerDiscoveryListener(on_update)
        self.browser = ServiceBrowser(self.zeroconf, SERVICE_TYPE, self.listener)

    def stop(self) -> None:
        if self.browser:
            self.browser.cancel()
        if self.zeroconf:
            self.zeroconf.close()

    def get_workers(self) -> Dict[str, WorkerInfo]:
        if self.listener:
            return self.listener.workers
        return {}


async def discover_workers(timeout: float = 3.0):
    """
    Discover available workers on the LAN using mDNS.
    Returns a list of dicts with worker info.
    """
    results = []

    def on_update():
        pass  # No-op for CLI

    service = DiscoveryService()
    service.start(on_update)
    try:
        await asyncio.sleep(timeout)
        workers = service.get_workers()
        for w in workers.values():
            results.append({
                "worker_id": w.worker_id,
                "display_name": w.display_name,
                "ip": w.host,
                "port": w.port,
                "status": w.status.value,
                "platform": w.platform,
            })
    finally:
        service.stop()
    return results


# Global instance
discovery_service = DiscoveryService()
