import subprocess
import sys

def main():
    print("Dumping keychain items...")
    # Run security dump-keychain
    res = subprocess.run(["security", "dump-keychain"], capture_output=True, text=True)
    print(f"Stdout length: {len(res.stdout)}, Stderr: {res.stderr}")
    
    lines = res.stdout.splitlines()
    current_item = []
    
    for line in lines:
        if line.startswith("keychain: "):
            if current_item:
                process_item(current_item)
                current_item = []
            current_item.append(line)
        else:
            current_item.append(line)
            
    if current_item:
        process_item(current_item)

def process_item(lines):
    content = "\n".join(lines)
    targets = ["github", "suf-007", "mohammedsufiyan"]
    if any(t in content.lower() for t in targets):
        print("="*60)
        info = {}
        for line in lines:
            line = line.strip()
            if line.startswith("class:"):
                info["class"] = line
            elif '"acct"' in line:
                info["acct"] = line
            elif '"svce"' in line:
                info["svce"] = line
            elif '"srvr"' in line:
                info["srvr"] = line
            elif '"ptcl"' in line:
                info["ptcl"] = line
        print(f"Keychain Item Found:")
        for k, v in info.items():
            print(f"  {k}: {v}")
        for line in lines:
            if any(t in line.lower() for t in targets):
                print(f"    Match: {line.strip()}")

if __name__ == "__main__":
    main()
