"""
Minimal test worker - just advertises via mDNS and accepts TCP connections.
Run this to test if the backend can discover and connect to a worker.
"""

import socket
import uuid
import platform
from zeroconf import Zeroconf, ServiceInfo

SERVICE_TYPE = "_compute-worker._tcp.local."
PORT = 9000


def main():
    worker_id = f"worker-{uuid.uuid4().hex[:8]}"
    hostname = socket.gethostname()

    # Get local IP
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
    finally:
        s.close()

    print(f"Worker ID: {worker_id}")
    print(f"Local IP: {local_ip}")
    print(f"Port: {PORT}")

    # Advertise via mDNS
    zeroconf = Zeroconf()
    service_info = ServiceInfo(
        SERVICE_TYPE,
        f"{worker_id}.{SERVICE_TYPE}",
        addresses=[socket.inet_aton(local_ip)],
        port=PORT,
        properties={
            "worker_id": worker_id,
            "display_name": hostname,
            "status": "idle",
            "platform": platform.system(),
        },
    )

    print("Registering mDNS service...")
    zeroconf.register_service(service_info)
    print(f"Advertising as: {worker_id}.{SERVICE_TYPE}")

    # Start TCP server
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("0.0.0.0", PORT))
    server.listen(1)
    print(f"TCP server listening on port {PORT}")
    print("\n--- Waiting for connections (Ctrl+C to stop) ---\n")

    try:
        while True:
            conn, addr = server.accept()
            print(f"Connection from {addr}")

            # Read incoming data
            data = conn.recv(4096)
            if data:
                print(f"Received: {data.decode()}")
                # Send a simple response
                conn.send(b'{"type": "status", "state": "connected"}\n')

            conn.close()
            print(f"Connection closed\n")
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        zeroconf.unregister_service(service_info)
        zeroconf.close()
        server.close()


if __name__ == "__main__":
    main()
