import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('144.172.116.98', username='root', password='WhxKtp3Yq5u78P', timeout=15)

cmd = sys.argv[1] if len(sys.argv) > 1 else 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"'
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print("STDERR:", err)
ssh.close()
