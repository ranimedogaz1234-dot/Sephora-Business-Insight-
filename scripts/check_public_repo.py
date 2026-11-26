"""Check staged files and reachable Git history without printing secret values."""
import argparse
import re
import subprocess
import sys
from pathlib import PurePosixPath

PRIVATE_DIRECTORIES = {
    ".venv", "node_modules", ".next", "__pycache__", "cache", ".cache",
    "caches", "data", "datasets", "private", "secrets",
}
PRIVATE_SUFFIXES = {
    ".parquet", ".pkl", ".pickle", ".db", ".sqlite", ".sqlite3",
    ".pem", ".key", ".p12", ".pfx", ".jks", ".zip", ".7z", ".tar", ".gz", ".log",
}
PRIVATE_NAMES = {
    ".netrc", ".npmrc", ".pypirc", "credentials.json", "secrets.json",
    "config.local.json", "id_rsa", "id_ed25519",
}
PATTERNS = {
    "private key": r"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----",
    "GitHub token": r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b",
    "AI provider key": r"\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b",
    "cloud access key": r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
    "Google API key": r"\bAIza[A-Za-z0-9_-]{35}\b",
    "Slack token": r"\bxox[baprs]-[A-Za-z0-9-]{15,}\b",
    "credential in URL": r"\b[a-z][a-z0-9+.-]*://[^\s/@:]+:[^\s/@]+@",
    "public secret variable": r"\bNEXT_PUBLIC_[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b",
    "local user path": r"(?i)\b[A-Z]:[\\/]{1,2}Users[\\/]{1,2}[^\\/\s\"'`]+|(?<![\w.])/(?:Users|home)/[A-Za-z0-9._-]+/",
}
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
# Addresses that identify no one: GitHub's private commit addresses and reserved example domains.
PUBLIC_EMAIL_DOMAINS = ("users.noreply.github.com", "example.com", "example.org", "example.net")
PUBLIC_EMAILS = {"noreply@github.com"}
ASSIGNMENT = re.compile(
    r"""(?im)^[ \t]*(?:export[ \t]+)?["']?([A-Z0-9_.-]*(?:API_KEY|ACCESS_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_.-]*)["']?[ \t]*[:=][ \t]*(.*)$"""
)
SAFE_PLACEHOLDERS = {"", "your_key_here", "your_token_here", "replace_me", "changeme", "example", "placeholder"}
# A dependency version range such as "^4.0.0" (e.g. the npm package "js-tokens" in package-lock.json);
# alternatives joined by "||" are checked one by one.
VERSION_RANGE = re.compile(r"^(?:[\^~]\d+(?:\.\d+){0,2}|\d+\.\d+(?:\.\d+)?)(?:[-+][0-9A-Za-z.-]+)?$")


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args])


def entries(raw: bytes, oid_index: int):
    for item in raw.decode("utf-8", errors="replace").split("\0"):
        if not item:
            continue
        metadata, path = item.split("\t", 1)
        yield path, metadata.split()[oid_index]


def private_path(path: str) -> bool:
    file = PurePosixPath(path.lower())
    name = file.name
    if name == ".env.example":
        return any(part in PRIVATE_DIRECTORIES for part in file.parts[:-1])
    return (
        any(part in PRIVATE_DIRECTORIES for part in file.parts[:-1])
        or name in PRIVATE_NAMES
        or name.startswith((".env", "secrets.", "credentials."))
        or name.endswith((".local", ".local.yaml", ".local.yml", ".local.toml", ".local.json"))
        or file.suffix in PRIVATE_SUFFIXES
        or ".csv" in file.suffixes
    )


def personal_email(address: str) -> bool:
    address = address.lower()
    local, domain = address.rsplit("@", 1)
    if local == "git":  # SSH remote such as git@github.com:owner/repo
        return False
    return address not in PUBLIC_EMAILS and not any(
        domain == d or domain.endswith("." + d) for d in PUBLIC_EMAIL_DOMAINS
    )


def identity_email(variable: str) -> str:
    """Email Git will record for the next commit (environment overrides config)."""
    ident = git("var", variable).decode("utf-8", errors="replace")
    return ident[ident.find("<") + 1 : ident.rfind(">")]


def findings(blob: bytes):
    encoding = "utf-16" if blob.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
    source = blob.decode(encoding, errors="replace")
    for label, pattern in PATTERNS.items():
        if re.search(pattern, source):
            yield label
    if any(personal_email(m.group(0)) for m in EMAIL.finditer(source)):
        yield "personal email address"
    for match in ASSIGNMENT.finditer(source):
        value = match.group(2).strip().rstrip(",").strip("'\x22")
        if match.group(1).lower() == "persist-credentials" and value == "false":
            continue
        if value.lower() in SAFE_PLACEHOLDERS or value.startswith(("${", "$env:", "os.getenv(", "process.env.")):
            continue
        # "^3.0.0 || ^4.0.0": every alternative must itself be a version range.
        if all(VERSION_RANGE.match(part.strip()) for part in value.split("||")):
            continue
        yield "possible literal credential assignment"
        break


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pre-commit", action="store_true")
    parser.add_argument("--pre-push", action="store_true")
    args = parser.parse_args()
    tips = []
    if args.pre_push:
        for line in sys.stdin:
            _, local, _, _ = line.split()
            if local.strip("0"):
                tips.append(local)

    failed = False
    # Older history is already public; only commits about to be created or pushed are checked.
    hint = "use your GitHub noreply address (git config user.email <id>+<username>@users.noreply.github.com)"
    if args.pre_commit:
        for role in ("AUTHOR", "COMMITTER"):
            if personal_email(identity_email(f"GIT_{role}_IDENT")):
                print(f"Blocked personal email as commit {role.lower()}: {hint}", file=sys.stderr)
                failed = True
    if tips:
        new = git("rev-list", *tips, "--not", "--remotes").decode().split()
        for commit in new:
            emails = git("show", "-s", "--format=%ae%n%ce", commit).decode("utf-8", errors="replace").split()
            if any(personal_email(e) for e in emails if "@" in e):
                print(f"Blocked personal email on commit {commit[:12]}: {hint}", file=sys.stderr)
                failed = True

    paths_and_blobs = set(entries(git("ls-files", "-s", "-z"), 1))
    commits = git("rev-list", "--all", *tips).decode().splitlines()
    for commit in commits:
        paths_and_blobs.update(entries(git("ls-tree", "-r", "-z", commit), 2))
        for label in findings(git("show", "-s", "--format=%B", commit)):
            print(f"Blocked {label} in commit message: {commit[:12]}", file=sys.stderr)
            failed = True

    result = {}
    for path, blob in sorted(paths_and_blobs):
        if private_path(path):
            print(f"Blocked private file: {path}", file=sys.stderr)
            failed = True
            continue
        if blob not in result:
            result[blob] = list(findings(git("cat-file", "blob", blob)))
        for label in result[blob]:
            print(f"Blocked {label}: {path}", file=sys.stderr)
            failed = True
    if failed:
        return 1
    print(f"Public repository scan passed ({len(result)} unique blobs, {len(commits)} commits).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
