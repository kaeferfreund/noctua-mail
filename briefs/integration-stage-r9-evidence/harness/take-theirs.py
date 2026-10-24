import pathlib,re,sys
for f in sys.argv[1:]:
  p=pathlib.Path(f);s=p.read_text()
  s,n=re.subn(r'<<<<<<< [^\n]*\n.*?=======\n(.*?)>>>>>>> [^\n]+\n',lambda m:m[1],s,flags=re.S)
  assert '<<<<<<<' not in s and '=======\n' not in s
  p.write_text(s);print(f,n)
