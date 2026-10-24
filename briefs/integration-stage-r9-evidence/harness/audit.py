import os,pathlib,json,socket
root=str(pathlib.Path.cwd());anc=set();pid=os.getpid()
while pid>1:
 anc.add(pid)
 try:pid=int(pathlib.Path('/proc',str(pid),'stat').read_text().split(') ')[1].split()[1])
 except (OSError,ValueError):break
live=[]
for proc in pathlib.Path('/proc').iterdir():
 if not proc.name.isdigit() or int(proc.name) in anc:continue
 try:
  cwd=os.readlink(proc/'cwd')
  if cwd==root or cwd.startswith(root+'/.tmp/') or cwd.startswith(root+'/.next/standalone'):
   stat=(proc/'stat').read_text().split(') ')[1].split();cmd=(proc/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
   live.append({'pid':int(proc.name),'start_ticks':int(stat[19]),'state':stat[0],'command':cmd,'cwd':cwd})
 except (OSError,ValueError):pass
ports={}
for port in [3798,3799]:
 ports[str(port)]={}
 for af,label,addr in [(socket.AF_INET,'ipv4','127.0.0.1'),(socket.AF_INET6,'ipv6','::1')]:
  try:
   with socket.socket(af,socket.SOCK_STREAM) as s:
    s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind((addr,port));ports[str(port)][label]='free'
  except OSError as e:ports[str(port)][label]=str(e)
r={'live_worktree_processes':live,'reserved_ports':ports};pathlib.Path('.tmp/cleanup-audit.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2));assert not live;assert all(v=='free' for p in ports.values() for v in p.values())
