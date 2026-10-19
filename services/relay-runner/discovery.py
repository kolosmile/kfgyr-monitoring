"""Bounded, cancellable MTConnect discovery from the runner's network."""
from concurrent.futures import ThreadPoolExecutor, as_completed
import copy
import http.client
import ipaddress
import os
from pathlib import Path
import secrets
import socket
import ssl
import struct
import threading
import time
from urllib.parse import urlsplit

from defusedxml import ElementTree

from configuration import Problem


def local_networks(route_path):
    """Linux connected routes; host /proc/1/net/route may be mounted read-only."""
    try:
        lines = Path(route_path).read_text().splitlines()[1:]
    except OSError:
        return []
    result = []
    for line in lines:
        fields = line.split()
        if len(fields) < 8:
            continue
        interface, destination, gateway, flags = fields[:4]
        if interface == "*" or interface.startswith(("lo", "docker", "br-", "veth", "tailscale", "tun", "wg")):
            continue
        try:
            if int(gateway, 16) or not int(flags, 16) & 1:
                continue
            address = socket.inet_ntoa(struct.pack("<I", int(destination, 16)))
            mask = socket.inet_ntoa(struct.pack("<I", int(fields[7], 16)))
            network = ipaddress.IPv4Network((address, mask), strict=False)
            if network.prefixlen == 0 or network.prefixlen == 32 or network.is_loopback or network.is_link_local:
                continue
        except (ValueError, OSError):
            continue
        item = {"cidr": str(network), "interface": interface, "source": "detected"}
        if item not in result:
            result.append(item)
    return result


class Policy:
    def __init__(self, hosts=None, networks=None, route_path=None, discovery_networks=None):
        self.hosts = {s.strip().lower() for s in (hosts if hosts is not None else os.getenv("KFGYR_AGENT_ALLOWED_HOSTS", "demo.mtconnect.org")).split(",") if s.strip()}
        self.allowed = [ipaddress.ip_network(s.strip()) for s in (networks if networks is not None else os.getenv("KFGYR_AGENT_ALLOWED_NETWORKS", "")).split(",") if s.strip()]
        self.route_path = route_path if route_path is not None else os.getenv("KFGYR_HOST_ROUTES_FILE", "/proc/net/route")
        self.explicit = [ipaddress.IPv4Network(s.strip()) for s in (discovery_networks if discovery_networks is not None else os.getenv("KFGYR_DISCOVERY_NETWORKS", "")).split(",") if s.strip()]

    def networks(self):
        result = local_networks(self.route_path)
        for network in self.explicit:
            if str(network) not in [n["cidr"] for n in result]:
                result.append({"cidr": str(network), "interface": "configured", "source": "configured"})
        return result

    def allowed_ip(self, address, named=False):
        ip = ipaddress.ip_address(address)
        if ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_unspecified or ip.is_reserved:
            return False
        networks = self.allowed + [ipaddress.ip_network(n["cidr"]) for n in self.networks()]
        return any(ip.version == net.version and ip in net for net in networks) or (named and ip.is_global)

    def parse(self, raw):
        try:
            if not isinstance(raw, str) or any(c.isspace() or ord(c) < 32 for c in raw):
                raise ValueError()
            url = urlsplit(raw)
            if url.scheme not in ("http", "https") or not url.hostname or url.username is not None or url.password is not None or url.query or url.fragment:
                raise ValueError()
            port = url.port
            if port is not None and not 1 <= port <= 65535:
                raise ValueError()
        except ValueError:
            raise Problem(400, "Teljes HTTP(S) alap URL szükséges, hitelesítési adat, query és fragment nélkül.") from None
        try:
            ipaddress.ip_address(url.hostname)
        except ValueError:
            if url.hostname.lower() not in self.hosts:
                raise Problem(400, "Az agent hostneve nincs az engedélyezési listában.")
        else:
            if not self.allowed_ip(url.hostname):
                raise Problem(400, "Az agent IP-címe nincs az engedélyezett hálózatok között.")
        return url


def probe(policy, raw, timeout=8):
    url = policy.parse(raw)
    host = url.hostname
    port = url.port or (443 if url.scheme == "https" else 80)
    try:
        try:
            addresses = [str(ipaddress.ip_address(host))]
        except ValueError:
            addresses = list(dict.fromkeys(entry[4][0] for entry in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)))
    except OSError:
        raise Problem(502, "Az agent címe nem oldható fel.") from None
    addresses = [ip for ip in addresses if policy.allowed_ip(ip, host.lower() in policy.hosts)]
    if not addresses:
        raise Problem(400, "Az agent feloldott címe nincs engedélyezve.")
    # Connect to the validated IP itself; a second DNS lookup cannot redirect the request.
    for address in addresses[:2]:
        conn = None
        try:
            if url.scheme == "https":
                class PinnedTLS(http.client.HTTPSConnection):
                    def connect(self):
                        self.sock = socket.create_connection((address, port), timeout=timeout)
                        self.sock = self._context.wrap_socket(self.sock, server_hostname=host)
                conn = PinnedTLS(host, port, timeout=timeout, context=ssl.create_default_context())
            else:
                conn = http.client.HTTPConnection(address, port, timeout=timeout)
            deadline = time.monotonic() + timeout * 2
            conn.request("GET", url.path.rstrip("/") + "/probe", headers={"Host": url.netloc, "Accept": "application/xml"})
            response = conn.getresponse()
            if response.status != 200:
                raise Problem(502, f"Az agent HTTP {response.status} választ adott.")
            content = bytearray()
            while len(content) <= 4 * 1024 * 1024:
                if time.monotonic() > deadline:
                    raise Problem(502, "Az agent túl lassan válaszol.")
                chunk = response.read1(65536)
                if not chunk:
                    break
                content.extend(chunk)
            if len(content) > 4 * 1024 * 1024:
                raise Problem(502, "Az agent válasza túl nagy.")
            try:
                root = ElementTree.fromstring(content)
            except Exception:
                raise Problem(502, "A válasz nem érvényes MTConnect XML.") from None
            if root.tag.rsplit("}", 1)[-1] != "MTConnectDevices":
                raise Problem(502, "A válasz nem MTConnect eszközleírás.")
            devices = []
            for group in root:
                if group.tag.rsplit("}", 1)[-1] == "Devices":
                    for device in group:
                        if device.tag.rsplit("}", 1)[-1] == "Device" and device.get("id"):
                            devices.append({key: device.get(key, "") for key in ("id", "name", "uuid")})
            if not devices:
                raise Problem(502, "Az agent nem adott vissza eszközt.")
            return {"devices": devices}
        except (OSError, http.client.HTTPException):
            continue
        finally:
            if conn:
                conn.close()
    raise Problem(502, "Az agent nem érhető el. Ellenőrizd a címet, portot és TLS-beállítást.")


class Discovery:
    def __init__(self, policy):
        self.policy = policy
        self.lock = threading.RLock()
        self.jobs = {}
        self.stop = {}
        self.thread = None

    def start(self, cidr, ports):
        try:
            network = ipaddress.IPv4Network(cidr, strict=True)
        except ValueError:
            raise Problem(400, "Érvényes IPv4 hálózat szükséges, például 192.168.88.0/24.") from None
        allowed = [ipaddress.IPv4Network(n["cidr"]) for n in self.policy.networks()]
        if not any(network.subnet_of(parent) for parent in allowed):
            raise Problem(400, "Csak a relay felismert vagy külön engedélyezett hálózatán lehet keresni.")
        if network.num_addresses > 256:
            raise Problem(400, "Egyszerre legfeljebb 256 cím vizsgálható. Válassz /24 vagy kisebb hálózatot.")
        ports = list(dict.fromkeys(ports))
        if not 1 <= len(ports) <= 8 or any(type(p) is not int or not 1 <= p <= 65535 for p in ports):
            raise Problem(400, "1–8 darab, 1–65535 közötti port adható meg.")
        hosts = [str(ip) for ip in network.hosts() if self.policy.allowed_ip(str(ip))]
        with self.lock:
            if any(j["state"] in ("running", "cancelling") for j in self.jobs.values()):
                raise Problem(409, "Már fut egy hálózati keresés. Várd meg vagy állítsd le.")
            self.jobs = {k: v for k, v in self.jobs.items() if time.time() - v["created_at"] < 900}
            self.stop = {k: v for k, v in self.stop.items() if k in self.jobs}
            if len(self.jobs) >= 8:
                oldest = min(self.jobs, key=lambda k: self.jobs[k]["created_at"])
                del self.jobs[oldest]
                self.stop.pop(oldest, None)
            key = secrets.token_hex(12)
            job = {"id": key, "state": "running", "network": str(network), "ports": ports,
                   "completed": 0, "total": len(hosts) * len(ports), "results": [], "created_at": time.time()}
            self.jobs[key] = job
            self.stop[key] = threading.Event()
            self.thread = threading.Thread(target=self._run, args=(key, hosts, ports), daemon=True)
            self.thread.start()
            return copy.deepcopy(job)

    def _run(self, key, hosts, ports):
        event = self.stop[key]
        def candidate(ip, port):
            if event.is_set():
                return None
            url = f"{'https' if port == 443 else 'http'}://{ip}:{port}"
            try:
                result = probe(self.policy, url, timeout=1.5)
                return {"url": url, "ip": ip, "port": port, "devices": result["devices"]}
            except (Problem, OSError):
                return None
        try:
            with ThreadPoolExecutor(max_workers=24) as pool:
                futures = [pool.submit(candidate, ip, port) for ip in hosts for port in ports]
                cancelled_pending = False
                for future in as_completed(futures):
                    if event.is_set() and not cancelled_pending:
                        for pending in futures:
                            pending.cancel()
                        cancelled_pending = True
                    if future.cancelled():
                        continue
                    found = future.result()
                    with self.lock:
                        self.jobs[key]["completed"] += 1
                        if found:
                            self.jobs[key]["results"].append(found)
            with self.lock:
                self.jobs[key]["state"] = "cancelled" if event.is_set() else "completed"
        except Exception:
            with self.lock:
                self.jobs[key]["state"] = "failed"
                self.jobs[key]["message"] = "A hálózati keresés megszakadt. Próbáld újra."

    def get(self, key):
        with self.lock:
            if key not in self.jobs:
                raise Problem(404, "A keresés nem található vagy lejárt.")
            return copy.deepcopy(self.jobs[key])

    def cancel(self, key):
        with self.lock:
            job = self.get(key)
            if job["state"] in ("running", "cancelling"):
                self.stop[key].set()
                self.jobs[key]["state"] = "cancelling"
            return self.get(key)

    def latest(self):
        with self.lock:
            if not self.jobs:
                return None
            key = max(self.jobs, key=lambda k: self.jobs[k]["created_at"])
            return copy.deepcopy(self.jobs[key])

    def shutdown(self):
        with self.lock:
            for event in self.stop.values():
                event.set()
        if self.thread:
            self.thread.join(timeout=5)
