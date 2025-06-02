import http.server
import ssl
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer

# Define server parameters
HOST = 'localhost'
PORT = 4443  # Using 4443 to avoid needing root privileges (443 requires sudo)

# Generate a self-signed certificate (for testing purposes)
def generate_self_signed_cert():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes
    import datetime

    # Generate a private key
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )

    # Create a self-signed certificate
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, u"localhost")
    ])
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        datetime.datetime.utcnow() + datetime.timedelta(days=365)
    ).add_extension(
        x509.SubjectAlternativeName([x509.DNSName(u"localhost")]),
        critical=False
    ).sign(key, hashes.SHA256())

    # Save the certificate and key to files
    with open("server.crt", "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    with open("server.key", "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))

# Check if certificate and key exist, if not, generate them
if not os.path.exists("server.crt") or not os.path.exists("server.key"):
    generate_self_signed_cert()

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add cross-origin isolation headers
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

# Create the HTTP server with SimpleHTTPRequestHandler to serve files from current directory
server = http.server.HTTPServer((HOST, PORT), CustomHandler)
#server = http.server.HTTPServer((HOST, PORT), http.server.SimpleHTTPRequestHandler)

# Wrap the server socket with SSL
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile="server.crt", keyfile="server.key")

server.socket = context.wrap_socket(server.socket, server_side=True)

# Start the server
print(f"Server running on https://{HOST}:{PORT}")
print(f"Serving files from: {os.getcwd()}")
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped.")
    server.server_close()
