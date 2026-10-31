"""Shared SSL context that uses the OS trust store (works behind corporate/AV TLS proxies)."""
import ssl

try:
    import truststore

    SSL_CONTEXT: ssl.SSLContext | bool = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
except Exception:  # pragma: no cover
    SSL_CONTEXT = True
