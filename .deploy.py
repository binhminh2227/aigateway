import paramiko, sys
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.5.205", port=2222, username="nava", password="faker2252", timeout=20)
chan = c.get_transport().open_session(); chan.get_pty()
chan.exec_command("cd ~/aigateway && git pull && docker compose up -d --build 2>&1 | tail -10")
while True:
    if chan.recv_ready():
        d = chan.recv(4096); sys.stdout.buffer.write(d); sys.stdout.flush()
    if chan.exit_status_ready() and not chan.recv_ready(): break
print("\n--EXIT--", chan.recv_exit_status()); c.close()
