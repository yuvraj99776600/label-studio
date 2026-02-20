"""Quick VPS command runner."""
import paramiko, sys

timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 120

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.116.98', username='root', password='WhxKtp3Yq5u78P')
stdin, stdout, stderr = c.exec_command(sys.argv[1], timeout=timeout)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print("STDERR:", err)
c.close()
