#!/usr/bin/env python3
"""
Milestone 8: Off-Chain Storage Privacy & Encryption Audit Script
Inspects off-chain credential storage directory for plaintext PII, unauthorized metadata,
leaked secrets, and cryptographic structural integrity.
"""

import json
import os
import re
import stat
import sys

# Approved schema fields for EncryptedStorageRecord
APPROVED_STORAGE_FIELDS = {
    "credentialId",
    "credentialCommitment",
    "encryptionAlgorithm",
    "keyId",
    "iv",
    "authTag",
    "ciphertext",
    "createdAt",
    "updatedAt",
    "version",
}

PROHIBITED_PII_KEYWORDS = [
    "name",
    "firstname",
    "lastname",
    "dob",
    "dateofbirth",
    "ssn",
    "aadhaar",
    "passport",
    "email",
    "phone",
    "mobile",
    "address",
    "biometric",
    "salary",
    "bankaccount",
    "claims",
    "payload",
]

SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"api[_-]?key", re.IGNORECASE),
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"secret[_-]?key", re.IGNORECASE),
]

SAFE_FILENAME_REGEX = re.compile(r"^cred_[a-f0-9]{24}\.enc\.json$")
HEX_REGEX = re.compile(r"^[a-f0-9]+$", re.IGNORECASE)
COMMITMENT_REGEX = re.compile(r"^[a-f0-9]{64}$")


def audit_storage_directory(storage_dir):
    print("================================================================================")
    print(" Starting Off-Chain Storage Privacy & Encryption Audit")
    print(f" Target Directory: {storage_dir}")
    print("================================================================================")

    if not os.path.exists(storage_dir):
        print(f"[INFO] Storage directory does not exist yet ({storage_dir}). No off-chain files to audit.")
        print("[AUDIT RESULT] PASS: Zero plaintext credential files detected in storage.")
        return 0

    # Inspect directory permissions if running on POSIX
    if os.name == "posix":
        dir_stat = os.stat(storage_dir)
        mode = stat.S_IMODE(dir_stat.st_mode)
        print(f"[CHECK 1] Directory permissions: octal {oct(mode)} (expected restricted 0o700 or 0o755)")
        if mode & 0o077 and mode not in [0o700, 0o750, 0o755]:
            print(f"[WARN] Storage directory permissions {oct(mode)} may be overly permissive.")

    violations = []
    inspected_files = 0

    for root, dirs, files in os.walk(storage_dir):
        # Check for prohibited files like .env or private keys in storage
        for file in files:
            file_path = os.path.join(root, file)
            inspected_files += 1

            if file.startswith(".env"):
                violations.append(f"Secret environment file detected in storage: {file_path}")
                continue

            if file.endswith(".key") or file.endswith(".pem") or file.endswith(".sk"):
                violations.append(f"Cryptographic key file detected in storage: {file_path}")
                continue

            if not SAFE_FILENAME_REGEX.match(file) and not file.endswith(".tmp"):
                violations.append(
                    f"Filename does not conform to non-PII hashed format (cred_<sha256>.enc.json): {file}"
                )

            # Inspect file permissions
            if os.name == "posix":
                f_stat = os.stat(file_path)
                f_mode = stat.S_IMODE(f_stat.st_mode)
                if f_mode & 0o044 and f_mode not in [0o600, 0o644]:
                    violations.append(f"File permissions {oct(f_mode)} overly permissive on {file}")

            # Read and inspect content
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content_str = f.read()

                # Check secret patterns
                for pattern in SECRET_PATTERNS:
                    if pattern.search(content_str):
                        violations.append(f"Potential unencrypted secret or key pattern detected in {file_path}")

                # Parse JSON
                try:
                    record = json.loads(content_str)
                except Exception as e:
                    violations.append(f"Storage file is not valid JSON: {file_path} ({e})")
                    continue

                if not isinstance(record, dict):
                    violations.append(f"Storage file does not contain a JSON object: {file_path}")
                    continue

                # Check schema keys
                record_keys = set(record.keys())
                extra_keys = record_keys - APPROVED_STORAGE_FIELDS
                if extra_keys:
                    violations.append(
                        f"Disallowed fields detected in {file_path}: {list(extra_keys)}"
                    )

                # Check prohibited PII keywords
                for key in record_keys:
                    if key.lower() in PROHIBITED_PII_KEYWORDS:
                        violations.append(f"Prohibited PII field '{key}' detected in {file_path}")

                # Validate cryptographic structure
                if record.get("encryptionAlgorithm") != "AES-256-GCM":
                    violations.append(f"Invalid encryption algorithm in {file_path}: {record.get('encryptionAlgorithm')}")

                iv = record.get("iv", "")
                if len(iv) != 24 or not HEX_REGEX.match(iv):
                    violations.append(f"Invalid 12-byte hex IV in {file_path}: length={len(iv)}")

                auth_tag = record.get("authTag", "")
                if len(auth_tag) != 32 or not HEX_REGEX.match(auth_tag):
                    violations.append(f"Invalid 16-byte hex authTag in {file_path}: length={len(auth_tag)}")

                ciphertext = record.get("ciphertext", "")
                if not ciphertext or not HEX_REGEX.match(ciphertext) or len(ciphertext) % 2 != 0:
                    violations.append(f"Invalid hex ciphertext in {file_path}")

                commitment = record.get("credentialCommitment", "")
                if not COMMITMENT_REGEX.match(commitment):
                    violations.append(f"Invalid 64-character hex commitment in {file_path}")

            except Exception as e:
                violations.append(f"Error reading file {file_path}: {e}")

    print(f"\nTotal Storage Files Inspected: {inspected_files}")
    print(f"Total Privacy Violations Detected: {len(violations)}")

    if violations:
        print("\n[AUDIT FAILED] The following privacy/security violations were detected:")
        for v in violations:
            print(f"  - {v}")
        return 1

    print("\n[AUDIT RESULT] PASS: No raw PII fields were detected in the audited ledger/storage schema and no plaintext credential payloads were detected in the audited off-chain storage.")
    return 0


if __name__ == "__main__":
    default_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "storage", "credentials")
    )
    target = sys.argv[1] if len(sys.argv) > 1 else default_dir
    exit_code = audit_storage_directory(target)
    sys.exit(exit_code)
