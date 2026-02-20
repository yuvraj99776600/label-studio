"""Start Docker build on VPS in background and monitor it."""
import paramiko
import sys
import time

HOST = '144.172.116.98'
USER = 'root'
PASS = 'WhxKtp3Yq5u78P'

def run(cmd, timeout=30):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS)
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    c.close()
    return out, err

action = sys.argv[1] if len(sys.argv) > 1 else 'start'

if action == 'start':
    print("Starting build in background on VPS...")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS)
    # Use channel directly to avoid blocking
    transport = c.get_transport()
    channel = transport.open_session()
    channel.exec_command('nohup bash -c "cd /opt/label-studio-src && DOCKER_BUILDKIT=1 docker buildx build --load -t mltl-annotate:latest . > /tmp/build.log 2>&1" &')
    time.sleep(3)
    channel.close()
    c.close()
    # Check if it started
    out, _ = run('ps aux | grep "buildx build" | grep -v grep | wc -l')
    count = out.strip()
    if count and int(count) > 0:
        print(f"Build is running ({count} process(es))")
    else:
        print("Build may have finished or failed. Checking log...")
        out, _ = run('tail -20 /tmp/build.log')
        print(out)

elif action == 'status':
    out, _ = run('ps aux | grep "buildx build" | grep -v grep | wc -l')
    running = int(out.strip()) > 0
    if running:
        print("Build still running...")
        out, _ = run('tail -10 /tmp/build.log')
        print(out)
    else:
        print("Build finished. Last 30 lines:")
        out, _ = run('tail -30 /tmp/build.log')
        print(out)

elif action == 'log':
    out, _ = run('tail -50 /tmp/build.log')
    print(out)

elif action == 'switch':
    # Switch docker-compose to use local image
    print("Switching docker-compose.yml to use local image...")
    cmd = r"""cd /opt/label-studio && sed -i 's|image: ghcr.io/yuvraj99776600/label-studio:latest|image: mltl-annotate:latest|' docker-compose.yml && grep 'image:' docker-compose.yml"""
    out, _ = run(cmd)
    print(out)

elif action == 'restart':
    print("Restarting label-studio with local image...")
    out, _ = run('cd /opt/label-studio && docker compose up -d --force-recreate label-studio 2>&1', timeout=60)
    print(out)

elif action == 'verify':
    out, _ = run('curl -sI https://annotate.mltl.us/ 2>&1 | head -5')
    print(out)
