#!/usr/bin/env python3
import json
import re
import sys
import urllib.request
import base64

COUCH_INSTANCES = [
    {"name": "couchdb0.gov", "port": 5984},
    {"name": "couchdb1.gov", "port": 5985},
    {"name": "couchdb0.uni", "port": 6984},
    {"name": "couchdb1.uni", "port": 6985},
    {"name": "couchdb0.bank", "port": 7984},
    {"name": "couchdb1.bank", "port": 7985},
    {"name": "couchdb0.emp", "port": 8984},
    {"name": "couchdb1.emp", "port": 8985},
]

DB_NAME = "identity-channel_identity-registry"
AUTH_HEADER = "Basic " + base64.b64encode(b"admin:adminpw").decode("ascii")

# Approved schema fields:
# _id, _rev: CouchDB metadata
# ~version: Hyperledger Fabric ledger revision metadata
IDENTITY_APPROVED_FIELDS = {
    "_id",
    "_rev",
    "~version",
    "did",
    "identityCommitment",
    "status",
    "issuerOrg",
    "createdAt",
    "updatedAt",
    "version",
}

CREDENTIAL_APPROVED_FIELDS = {
    "_id",
    "_rev",
    "~version",
    "credentialId",
    "subjectDID",
    "issuerDID",
    "issuerOrg",
    "credentialType",
    "schemaId",
    "credentialCommitment",
    "issuedAt",
    "expiresAt",
    "status",
    "revocationReason",
    "revokedAt",
    "createdAt",
    "updatedAt",
    "version",
}

COMMITMENT_REGEX = re.compile(r"^[a-f0-9]{64}$")
DID_REGEX = re.compile(r"^did:[a-zA-Z0-9]+:[a-zA-Z0-9_:.-]+$")
ISO_DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$")
ALLOWED_STATUSES = {"ACTIVE", "SUSPENDED", "REVOKED"}
ALLOWED_ORGS = {"GovMSP", "UniversityMSP", "BankMSP", "EmployerMSP"}
ALLOWED_CRED_TYPES = {
    "GovernmentIdCredential",
    "AcademicDegreeCredential",
    "KYCCredential",
    "EmploymentCredential",
}
ALLOWED_REVOCATION_REASONS = {
    "KEY_COMPROMISE",
    "AFFILIATION_CHANGED",
    "SUPERSEDED",
    "CESSATION_OF_OPERATION",
    "PRIVILEGE_WITHDRAWN",
    "UNSPECIFIED",
}

def audit_all_couchdbs():
    print(f"=== Auditing Zero Raw PII & Schema Compliance across ALL {len(COUCH_INSTANCES)} CouchDB Instances ===")
    all_passed = True
    total_docs_seen = 0

    for inst in COUCH_INSTANCES:
        name = inst["name"]
        port = inst["port"]
        url = f"http://localhost:{port}/{DB_NAME}/_all_docs?include_docs=true"
        req = urllib.request.Request(url, headers={"Authorization": AUTH_HEADER})

        try:
            with urllib.request.urlopen(req) as resp:
                if resp.status != 200:
                    print(f"[-] {name} (port {port}): HTTP error {resp.status}")
                    all_passed = False
                    continue
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"[-] {name} (port {port}): Failed to connect or read DB: {e}")
            all_passed = False
            continue

        rows = data.get("rows", [])
        total_rows = data.get("total_rows", len(rows))
        print(f"[+] {name} (port {port}): connected successfully. Total documents: {total_rows}")

        for row in rows:
            doc = row.get("doc", {})
            doc_id = doc.get("_id", "")
            if doc_id.startswith("_design/"):
                continue  # Skip CouchDB design documents if any

            total_docs_seen += 1
            doc_keys = set(doc.keys())

            # Identify document type
            if "credentialId" in doc:
                # Credential Record
                unapproved = doc_keys - CREDENTIAL_APPROVED_FIELDS
                if unapproved:
                    print(f"  [!] FAIL: Found unapproved fields {unapproved} in credential doc {doc_id} on {name}")
                    all_passed = False

                sub_did = doc.get("subjectDID", "")
                if not DID_REGEX.match(sub_did):
                    print(f"  [!] FAIL: Invalid subjectDID format '{sub_did}' in doc {doc_id} on {name}")
                    all_passed = False

                iss_did = doc.get("issuerDID", "")
                if not DID_REGEX.match(iss_did):
                    print(f"  [!] FAIL: Invalid issuerDID format '{iss_did}' in doc {doc_id} on {name}")
                    all_passed = False

                cred_comm = doc.get("credentialCommitment", "")
                if not COMMITMENT_REGEX.match(cred_comm):
                    print(f"  [!] FAIL: Invalid credentialCommitment '{cred_comm}' in doc {doc_id} on {name}")
                    all_passed = False

                cred_type = doc.get("credentialType", "")
                if cred_type not in ALLOWED_CRED_TYPES:
                    print(f"  [!] FAIL: Invalid credentialType '{cred_type}' in doc {doc_id} on {name}")
                    all_passed = False

                status = doc.get("status", "")
                if status not in ALLOWED_STATUSES:
                    print(f"  [!] FAIL: Invalid status '{status}' in doc {doc_id} on {name}")
                    all_passed = False

                issuer_org = doc.get("issuerOrg", "")
                if issuer_org not in ALLOWED_ORGS:
                    print(f"  [!] FAIL: Invalid issuerOrg '{issuer_org}' in doc {doc_id} on {name}")
                    all_passed = False

                # Optional revocation metadata
                rev_reason = doc.get("revocationReason")
                if rev_reason is not None and rev_reason not in ALLOWED_REVOCATION_REASONS:
                    print(f"  [!] FAIL: Invalid revocationReason '{rev_reason}' in doc {doc_id} on {name}")
                    all_passed = False

                rev_at = doc.get("revokedAt")
                if rev_at is not None and not ISO_DATE_REGEX.match(rev_at):
                    print(f"  [!] FAIL: Invalid revokedAt timestamp '{rev_at}' in doc {doc_id} on {name}")
                    all_passed = False

                version = doc.get("version")
                if not isinstance(version, int) or version < 1:
                    print(f"  [!] FAIL: Invalid version '{version}' in doc {doc_id} on {name}")
                    all_passed = False

            elif "did" in doc:
                # Identity Record
                unapproved = doc_keys - IDENTITY_APPROVED_FIELDS
                if unapproved:
                    print(f"  [!] FAIL: Found unapproved fields {unapproved} in identity doc {doc_id} on {name}")
                    all_passed = False

                did = doc.get("did", "")
                if not DID_REGEX.match(did):
                    print(f"  [!] FAIL: Invalid DID format '{did}' in doc {doc_id} on {name}")
                    all_passed = False

                commitment = doc.get("identityCommitment", "")
                if not COMMITMENT_REGEX.match(commitment):
                    print(f"  [!] FAIL: Invalid commitment format (not 64 lowercase hex): '{commitment}' in doc {doc_id} on {name}")
                    all_passed = False

                status = doc.get("status", "")
                if status not in ALLOWED_STATUSES:
                    print(f"  [!] FAIL: Invalid status '{status}' in doc {doc_id} on {name}")
                    all_passed = False

                issuer = doc.get("issuerOrg", "")
                if not issuer:
                    print(f"  [!] FAIL: Missing issuerOrg in doc {doc_id} on {name}")
                    all_passed = False

                version = doc.get("version")
                if not isinstance(version, int) or version < 1:
                    print(f"  [!] FAIL: Invalid version '{version}' in doc {doc_id} on {name}")
                    all_passed = False
            else:
                print(f"  [!] FAIL: Unknown document structure in doc {doc_id} on {name}")
                all_passed = False

            # Strict PII check: scan all values for any plain text PII patterns
            doc_str = json.dumps(doc).lower()
            pii_keywords = ["firstname", "lastname", "email", "phone", "address", "aadhaar", "ssn", "passport", "birthdate"]
            for kw in pii_keywords:
                if f'"{kw}"' in doc_str:
                    print(f"  [!] FAIL: Suspicious PII keyword '{kw}' found in doc {doc_id} on {name}")
                    all_passed = False

    print(f"=== Completed Audit across {len(COUCH_INSTANCES)} CouchDB Instances ===")
    print(f"Total document inspections: {total_docs_seen}")
    if all_passed:
        print("[PASS] All CouchDB instances verified: No raw PII fields or detected PII-keyword fields were present in the audited ledger documents, and strict schema compliance verified across all 8 nodes.")
        return 0
    else:
        print("[FAIL] Audit discovered schema violations or raw PII!")
        return 1

if __name__ == "__main__":
    sys.exit(audit_all_couchdbs())
