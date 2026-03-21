from __future__ import annotations

import socket
import threading
from typing import Callable, Optional

from zeroconf import ServiceBrowser, ServiceInfo, ServiceListener, Zeroconf

from app.models.messages import HostInfo, HostStatus

SERVICE_TYPE = "_computebnb-host._tcp.local."


class HostDiscoveryListener(ServiceListener):
    def __init__(self, on_update: Optional[Callable[[], None]] = None):
        self.hosts: dict[str, HostInfo] = {}
        self.on_update = on_update
        self._lock = threading.Lock()

    def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        self._refresh_service(zc, type_, name)

    def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        self._refresh_service(zc, type_, name)

    def remove_service(self, _zc: Zeroconf, _type: str, name: str) -> None:
        host_id = name.split(".", 1)[0]
        with self._lock:
            if host_id in self.hosts:
                del self.hosts[host_id]
        self._notify()

    def get_hosts(self) -> dict[str, HostInfo]:
        with self._lock:
            return dict(self.hosts)

    def _refresh_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        info = zc.get_service_info(type_, name)
        if not info:
            return

        props = {
            self._decode_value(key): self._decode_value(value)
            for key, value in info.properties.items()
        }
        addresses = info.parsed_addresses()
        host = HostInfo(
            host_id=props.get("host_id") or name.split(".", 1)[0],
            display_name=props.get("display_name") or name.split(".", 1)[0],
            host=props.get("host") or (addresses[0] if addresses else ""),
            port=info.port,
            status=HostStatus(props.get("status", HostStatus.IDLE.value)),
            platform=props.get("platform"),
            runtime=props.get("runtime", "docker-first"),
            last_seen="just now",
        )
        with self._lock:
            self.hosts[host.host_id] = host
        self._notify()

    def _notify(self) -> None:
        if self.on_update:
            self.on_update()

    @staticmethod
    def _decode_value(value: object) -> str:
        if isinstance(value, bytes):
            return value.decode(errors="ignore")
        return str(value)


class DiscoveryService:
    def __init__(self) -> None:
        self.zeroconf: Optional[Zeroconf] = None
        self.browser: Optional[ServiceBrowser] = None
        self.listener: Optional[HostDiscoveryListener] = None
        self.registered_service: Optional[ServiceInfo] = None

    def start(self, on_update: Optional[Callable[[], None]] = None) -> None:
        if self.zeroconf:
            return
        self.zeroconf = Zeroconf()
        self.listener = HostDiscoveryListener(on_update)
        self.browser = ServiceBrowser(self.zeroconf, SERVICE_TYPE, self.listener)

    def stop(self) -> None:
        self.unregister_host()
        if self.browser:
            self.browser.cancel()
            self.browser = None
        if self.zeroconf:
            self.zeroconf.close()
            self.zeroconf = None
        self.listener = None

    def get_hosts(self) -> dict[str, HostInfo]:
        if not self.listener:
            return {}
        return self.listener.get_hosts()

    def register_host(self, host: HostInfo) -> None:
        if not self.zeroconf:
            raise RuntimeError("Discovery service is not running")

        info = ServiceInfo(
            type_=SERVICE_TYPE,
            name=f"{host.host_id}.{SERVICE_TYPE}",
            addresses=[socket.inet_aton(host.host)],
            port=host.port,
            properties={
                "host_id": host.host_id,
                "display_name": host.display_name,
                "host": host.host,
                "status": host.status.value,
                "platform": host.platform or "Unknown",
                "runtime": host.runtime,
            },
        )

        if self.registered_service:
            self.unregister_host()
        self.zeroconf.register_service(info)
        self.registered_service = info

    def update_host(self, host: HostInfo) -> None:
        if not self.zeroconf or not self.registered_service:
            return

        updated = ServiceInfo(
            type_=SERVICE_TYPE,
            name=self.registered_service.name,
            addresses=[socket.inet_aton(host.host)],
            port=host.port,
            properties={
                "host_id": host.host_id,
                "display_name": host.display_name,
                "host": host.host,
                "status": host.status.value,
                "platform": host.platform or "Unknown",
                "runtime": host.runtime,
            },
        )
        self.zeroconf.update_service(updated)
        self.registered_service = updated

    def unregister_host(self) -> None:
        if self.zeroconf and self.registered_service:
            try:
                self.zeroconf.unregister_service(self.registered_service)
            finally:
                self.registered_service = None


discovery_service = DiscoveryService()
