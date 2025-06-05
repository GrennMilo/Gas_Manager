import os
import ipaddress
import socket
from datetime import datetime, timedelta
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

# Get local IP address
def get_local_ip():
    try:
        # Create a socket connection to an external server
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Doesn't need to be reachable
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "192.168.1.254"  # Fallback to localhost if can't determine IP

local_ip = get_local_ip()
print(f"Local IP detected: {local_ip}")

# Create output directory
os.makedirs('ssl', exist_ok=True)

# Generate private key
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)

# Create a self-signed certificate
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, "IT"),
    x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Italy"),
    x509.NameAttribute(NameOID.LOCALITY_NAME, "Local"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, "RMIC"),
    x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
])

# Use datetime.now() instead of utcnow()
now = datetime.now()

# Build the SAN list
san_list = [
    x509.DNSName("localhost"),
    x509.DNSName("192.168.1.254"),
    x509.IPAddress(ipaddress.IPv4Address("192.168.1.254")),
]

# Add local IP to SAN list
if local_ip != "192.168.1.254":
    san_list.append(x509.IPAddress(ipaddress.IPv4Address(local_ip)))
    san_list.append(x509.DNSName(local_ip))
    print(f"Added {local_ip} to certificate SAN")

cert = x509.CertificateBuilder().subject_name(
    subject
).issuer_name(
    issuer
).public_key(
    private_key.public_key()
).serial_number(
    x509.random_serial_number()
).not_valid_before(
    now
).not_valid_after(
    now + timedelta(days=3650)  # Extended to 10 years
).add_extension(
    x509.SubjectAlternativeName(san_list),
    critical=False,
).sign(private_key, hashes.SHA256())

# Write private key to file
with open("ssl/key.pem", "wb") as f:
    f.write(private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ))

# Write certificate to file
with open("ssl/cert.pem", "wb") as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))

print("SSL certificates generated successfully in 'ssl' directory")
print("\nIMPORTANT: When accessing the application via HTTPS, you will need to")
print("manually accept the self-signed certificate in your browser.")
print("This is normal for development environments.")
print("\nInstructions:")
print("1. Open the application URL in your browser")
print("2. You'll see a security warning")
print("3. Click 'Advanced' or 'Details'")
print("4. Click 'Proceed anyway' or 'Accept Risk and Continue'")
print("5. You only need to do this once per browser session") 